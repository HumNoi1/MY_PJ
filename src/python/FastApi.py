from fastapi import FastAPI, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.llms import LlamaCpp
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from supabase import create_client
import pypdf
import os
from typing import Dict
from io import BytesIO
from pydantic import BaseModel
from dotenv import load_dotenv

# โหลด environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env.local'))

# Initialize FastAPI
app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase
supabaseUrl = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabaseAnonKey = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not supabaseUrl or not supabaseAnonKey:
    raise ValueError('Missing Supabase environment variables')

supabase = create_client(supabaseUrl, supabaseAnonKey)

# LLM
callback_manager = CallbackManager([StreamingStdOutCallbackHandler()])
llm = LlamaCpp(
    model_path="models/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    temperature=0.1,
    max_tokens=512,
    n_ctx=2048,
    callback_manager=callback_manager,
    n_gpu_layers=1,
    verbose=True,
)

# Embeddings
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={'device': 'cuda'}
)

class QueryRequest(BaseModel):
    question: str
    class_id: str
    custom_prompt: str | None = None

@app.get("/status/{filename}")
async def check_file_status(filename: str):
    try:
        print(f"Checking status for file: {filename}")  # Debug log
        
        # ตรวจสอบในตาราง documents
        result = supabase.from_('documents') \
            .select('id') \
            .eq('metadata->>file_name', filename) \
            .execute()
        
        is_processed = len(result.data) > 0
        print(f"File {filename} processed status: {is_processed}")  # Debug log
        
        return {
            "is_processed": is_processed,
            "filename": filename
        }
    except Exception as e:
        print(f"Error checking file status: {str(e)}")  # Debug log
        raise HTTPException(
            status_code=500,
            detail=f"Error checking file status: {str(e)}"
        )

@app.post("/process-pdf")
async def process_pdf(file: UploadFile, class_id: str = Form(...)):
    try:
        print(f"Processing file: {file.filename} for class: {class_id}")
        
        # อ่านและประมวลผล PDF
        content = await file.read()
        pdf_file = BytesIO(content)
        
        pdf_reader = pypdf.PdfReader(pdf_file)
        text_content = ""
        for page in pdf_reader.pages:
            text_content += page.extract_text()
            
        print(f"Extracted text length: {len(text_content)}")

        # แบ่งข้อความ
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        chunks = text_splitter.split_text(text_content)
        print(f"Split into {len(chunks)} chunks")

        # สร้างและเก็บ embeddings
        for i, chunk in enumerate(chunks, 1):
            try:
                print(f"Processing chunk {i}/{len(chunks)}")
                embedding = embeddings.embed_query(chunk)
                
                result = supabase.from_('documents').insert({
                    "content": chunk,
                    "embedding": embedding,
                    "metadata": {
                        "class_id": class_id,
                        "file_name": file.filename,
                        "chunk_index": i
                    }
                }).execute()
                
                if hasattr(result, 'error') and result.error is not None:
                    raise Exception(f"Supabase error: {result.error}")
                
                print(f"Stored chunk {i}/{len(chunks)}")
                
            except Exception as e:
                print(f"Error processing chunk {i}: {str(e)}")
                continue

        return {
            "status": "success",
            "message": f"Successfully processed {len(chunks)} chunks",
            "filename": file.filename
        }

    except Exception as e:
        print(f"Error processing file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
@app.post("/query")
async def query(request: QueryRequest):
    try:
        print(f"Received query: {request.question}")  # Debug log
        
        # Create embedding for the question
        question_embedding = embeddings.embed_query(request.question)
        
        # Search for relevant documents
        results = supabase.from_('documents') \
            .select('content, metadata') \
            .execute()
            
        if not results.data:
            raise HTTPException(status_code=404, detail="No documents found")
            
        # Create context from matched documents
        context = "\n\n".join([doc['content'] for doc in results.data])

        # Create prompt
        prompt = request.custom_prompt if request.custom_prompt else f"""
        ใช้บริบทต่อไปนี้ในการตอบคำถาม:

        บริบท:
        {context}

        คำถาม:
        {request.question}

        คำตอบ:
        """

        # Get response from LLM
        response = llm(prompt)

        print(f"Generated response: {response}")  # Debug log
        return {"response": response.strip()}

    except Exception as e:
        print(f"Error in query: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)