# rag_system.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from llama_cpp import Llama
from supabase import create_client
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import FAISS
from langchain.embeddings import HuggingFaceEmbeddings
import PyPDF2
import io
import os

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# Initialize Llama
llm = Llama(
    model_path="models/llama-2-7b-chat.gguf",
    n_ctx=4096,  # Increased context window
    n_threads=4
)

# Initialize embeddings
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

# Vector store
vector_store = None

def process_pdf(pdf_content):
    """Extract text from PDF"""
    pdf_file = io.BytesIO(pdf_content)
    pdf_reader = PyPDF2.PdfReader(pdf_file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()
    return text

async def initialize_vector_store():
    """Initialize or update vector store with documents"""
    global vector_store
    
    # Get all teacher files from Supabase
    files = []
    for class_folder in supabase.storage.from_('class-files').list():
        teacher_files = supabase.storage.from_('class-files').list(f"{class_folder['name']}/teacher")
        files.extend([f"{class_folder['name']}/teacher/{file['name']}" for file in teacher_files if file['name'].endswith('.pdf')])

    # Process each file
    documents = []
    for file_path in files:
        try:
            response = supabase.storage.from_('class-files').download(file_path)
            if response:
                text = process_pdf(response)
                documents.append(text)
        except Exception as e:
            print(f"Error processing {file_path}: {str(e)}")

    # Split documents
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    splits = text_splitter.create_documents(documents)

    # Create or update vector store
    vector_store = FAISS.from_documents(splits, embeddings)

class ChatRequest(BaseModel):
    message: str
    class_id: str

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        if vector_store is None:
            await initialize_vector_store()

        # Get relevant documents
        relevant_docs = vector_store.similarity_search(
            request.message,
            k=3  # Number of relevant chunks to retrieve
        )

        # Create context from relevant documents
        context = "\n".join([doc.page_content for doc in relevant_docs])

        # Create prompt with context
        prompt = f"""Use the following information to answer the question. If the information is not relevant, respond based on your general knowledge.

Context:
{context}

Question: {request.message}

Answer:"""

        # Generate response
        response = llm.create_completion(
            prompt,
            max_tokens=500,
            temperature=0.7,
            top_p=0.95,
            stop=["Question:", "\n\n"],
            echo=False
        )

        return {
            "response": response['choices'][0]['text'].strip(),
            "sources": [doc.page_content[:200] + "..." for doc in relevant_docs]  # Return sources for reference
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/refresh-documents")
async def refresh_documents():
    """Endpoint to manually refresh the vector store"""
    try:
        await initialize_vector_store()
        return {"message": "Document store refreshed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)