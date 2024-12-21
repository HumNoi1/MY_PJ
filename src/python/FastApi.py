from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.llms import LlamaCpp
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from supabase.client import create_client
from pinecone import Pinecone
import pypdf
import os
from typing import Dict
from io import BytesIO
from pydantic import BaseModel
from dotenv import load_dotenv

from fastapi import FastAPI
from supabase import create_client
import os
from dotenv import load_dotenv
from pathlib import Path

# สร้าง FastAPI app
app = FastAPI()

# เพิ่ม CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# หา path ของ .env.local
current_file = Path(__file__)
project_root = current_file.parent.parent.parent
env_path = project_root / '.env.local'

print(f"Loading .env.local from: {env_path}")
print(f"File exists: {env_path.exists()}")

# โหลด environment variables
load_dotenv(env_path)

# Supabase setup
supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
supabase_key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

print(f"Supabase URL found: {'Yes' if supabase_url else 'No'}")
print(f"Supabase Key found: {'Yes' if supabase_key else 'No'}")

if not supabase_url or not supabase_key:
    raise ValueError(
        "Missing Supabase environment variables.\n"
        f"Attempting to load from: {env_path}\n"
        f"URL: {'Found' if supabase_url else 'Missing'}\n"
        f"Key: {'Found' if supabase_key else 'Missing'}"
    )

# สร้าง Supabase client
supabase = create_client(supabase_url, supabase_key)

# Pinecone setup
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))

# Pinecone setup
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))

# LLM setup
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

# Embeddings setup
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={'device': 'cuda'}
)

class QueryRequest(BaseModel):
    question: str
    class_id: str
    custom_prompt: str | None = None
    file_name: str | None = None

def create_prompt(context: str, question: str, custom_prompt: str | None = None) -> str:
    if custom_prompt:
        return custom_prompt.replace("{context}", context).replace("{question}", question)
    
    return f"""
    ใช้บริบทต่อไปนี้ในการตอบคำถาม:
    บริบท: {context}
    คำถาม: {question}
    คำตอบ:
    """

@app.post("/process-pdf")
async def process_pdf(file: UploadFile, class_id: str):
    try:
        # 1. อ่านไฟล์และบันทึกใน Supabase Storage
        content = await file.read()
        file_path = f"{class_id}/{file.filename}"
        
        storage_response = await supabase.storage.from_("class-files").upload(
            file_path, 
            content
        )
        
        if storage_response.error:
            raise HTTPException(status_code=500, detail="Failed to upload to storage")

        # 2. แปลง PDF เป็นข้อความ
        pdf_file = BytesIO(content)
        pdf_reader = pypdf.PdfReader(pdf_file)
        text_content = ""
        for page in pdf_reader.pages:
            text_content += page.extract_text()

        # 3. แบ่งข้อความ
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        chunks = text_splitter.split_text(text_content)

        # 4. สร้าง embeddings และบันทึกใน Pinecone
        vectors = []
        for i, chunk in enumerate(chunks):
            embedding = embeddings.embed_query(chunk)
            vector_id = f"{file_path}_{i}"
            
            vectors.append({
                "id": vector_id,
                "values": embedding,
                "metadata": {
                    "class_id": class_id,
                    "file_name": file.filename,
                    "file_path": file_path,
                    "chunk": chunk,
                    "chunk_index": i
                }
            })
            
            if len(vectors) >= 100:  # Batch upsert
                index.upsert(vectors=vectors)
                vectors = []
                
        if vectors:
            index.upsert(
                vectors=vectors,
                namespace=class_id  # อาจใช้ namespace เพื่อแยกข้อมูลตาม class
            )

        return {
            "status": "success",
            "message": f"Successfully processed {len(chunks)} chunks",
            "file_name": file.filename
        }

    except Exception as e:
        print(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query")
async def query(request: QueryRequest):
    try:
        # 1. สร้าง embedding สำหรับคำถาม
        query_embedding = embeddings.embed_query(request.question)
        
        # 2. กำหนด filter สำหรับการค้นหา
        filter_params = {"class_id": request.class_id}
        if request.file_name:
            filter_params["file_name"] = request.file_name
            
        # 3. ค้นหาใน Pinecone
        query_response = index.query(
            vector=query_embedding,
            filter={
                "class_id": request.class_id,
                "file_name": request.file_name
            } if request.file_name else {"class_id": request.class_id},
            top_k=5,
            include_metadata=True,
            namespace=request.class_id  # ใช้ namespace ถ้าคุณตั้งค่าไว้ตอน upsert
        )
        
        # 4. รวบรวมข้อความที่เกี่ยวข้อง
        contexts = [match.metadata["chunk"] for match in query_response.matches]
        context_text = "\n\n".join(contexts)
        
        # 5. สร้างคำตอบด้วย LLM
        prompt = create_prompt(context_text, request.question, request.custom_prompt)
        response = llm(prompt)
        
        return {"response": response.strip()}
        
    except Exception as e:
        print(f"Error in query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/document/{class_id}/{file_name}")
async def delete_document(class_id: str, file_name: str):
    try:
        # 1. ลบไฟล์จาก Supabase Storage
        file_path = f"{class_id}/{file_name}"
        storage_response = await supabase.storage.from_("class-files").remove([file_path])
        
        if storage_response.error:
            raise HTTPException(status_code=500, detail="Failed to delete from storage")
            
        # 2. ลบ vectors จาก Pinecone
        # หา vectors ทั้งหมดที่เกี่ยวข้องกับไฟล์นี้
        vectors_to_delete = []
        vector_id_prefix = f"{file_path}_"
        
        # ค้นหาและลบ vectors ที่เกี่ยวข้อง
        index.delete(
            filter={
                "class_id": class_id,
                "file_name": file_name
            },
            namespace=class_id  # ถ้าคุณใช้ namespace
        )
        
        return {"status": "success", "message": "Document deleted successfully"}
        
    except Exception as e:
        print(f"Error deleting document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)