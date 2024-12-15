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

class QueryRequest(BaseModel):
    question: str
    class_id: str
    file_id: str

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# Initialize LLM
callback_manager = CallbackManager([StreamingStdOutCallbackHandler()])
llm = LlamaCpp(
    model_path="models/llama-3.2-3b-chat.Q4_K_M.gguf",
    temperature=0.1,
    max_tokens=512,
    n_ctx=2048,
    callback_manager=callback_manager,
    n_gpu_layers=1,
    verbose=True,
)

# Initialize embeddings
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={'device': 'cuda'}
)

@app.post("/process-pdf")
async def process_pdf(file: UploadFile, class_id: str = Form(...)):
    try:
        # Read PDF content
        content = await file.read()
        pdf_file = BytesIO(content)
        
        # Extract text from PDF
        pdf_reader = pypdf.PdfReader(pdf_file)
        text_content = ""
        for page in pdf_reader.pages:
            text_content += page.extract_text()

        # Split text into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        chunks = text_splitter.split_text(text_content)

        # Create and store embeddings
        for chunk in chunks:
            embedding = embeddings.embed_query(chunk)
            await supabase.rpc(
                'store_document',
                {
                    'content': chunk,
                    'embedding': embedding,
                    'metadata': {
                        'class_id': class_id,
                        'file_name': file.filename
                    }
                }
            ).execute()

        return {"status": "success", "message": "File processed successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query")
async def query(request: QueryRequest):
    try:
        # Create embedding for the question
        question_embedding = embeddings.embed_query(request.question)
        
        # Search for relevant documents
        matches = await supabase.rpc(
            'search_documents',
            {
                'query_embedding': question_embedding,
                'match_threshold': 0.7,
                'match_count': 3,
                'class_id': request.class_id
            }
        ).execute()

        # Create context from matched documents
        context = "\n\n".join([match['content'] for match in matches.data])

        # Create prompt
        prompt = f"""Use the following context to answer the question. 
        If you cannot find the answer in the context, say so.

        Context:
        {context}

        Question:
        {request.question}

        Answer:"""

        # Get response from LLM
        response = llm(prompt)

        return {"response": response.strip()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)