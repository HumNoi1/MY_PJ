from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.llms import LlamaCpp
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
import pypdf
import tempfile
import os
from typing import List, Dict
from pydantic import BaseModel

# Setup paths
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
MODEL_PATH = os.path.join(MODELS_DIR, "Llama-3.2-3B-Instruct-Q4_K_M.gguf")

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
llm = None
vector_stores: Dict[str, FAISS] = {}  # Store multiple vector stores by file name

# Default prompt template
DEFAULT_PROMPT = """You are a helpful AI assistant analyzing a document. 
Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know. Don't try to make up an answer.

Context: {context}

Question: {question}

Answer: """

def initialize_llm():
    """Initialize LlamaCpp with local model"""
    global llm
    try:
        if not os.path.exists(MODEL_PATH):
            print(f"Model not found at {MODEL_PATH}")
            return False
            
        callback_manager = CallbackManager([StreamingStdOutCallbackHandler()])
        
        llm = LlamaCpp(
            model_path=MODEL_PATH,
            temperature=0.7,
            max_tokens=2000,
            n_ctx=2048,          # Context window
            n_threads=8,         # CPU threads
            n_gpu_layers=1,     # Use GPU for inference
            callback_manager=callback_manager,
            verbose=True,
        )
        
        # Test the model
        try:
            llm("test")
            print(f"Successfully initialized model at {MODEL_PATH}")
            return True
        except Exception as e:
            print(f"Model test failed: {str(e)}")
            return False
            
    except Exception as e:
        print(f"Error initializing LLM: {str(e)}")
        return False

# Initialize embeddings - using HuggingFace for better compatibility
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={'device': 'cuda'}  # Use GPU if available, falls back to CPU
)

class QueryRequest(BaseModel):
    question: str
    custom_prompt: str = ""
    filename: str

class ProcessingStatus(BaseModel):
    is_processed: bool
    filename: str = ""

def process_pdf(file_path: str) -> List[str]:
    """Extract text from PDF and split into chunks."""
    try:
        pdf_reader = pypdf.PdfReader(file_path)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        return text_splitter.split_text(text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing PDF: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """Initialize LLM on startup."""
    if not initialize_llm():
        print("Warning: LLM not initialized. Check if model exists in the models directory.")

@app.get("/status/{filename}")
async def get_processing_status(filename: str):
    """Check if a specific file has been processed."""
    return {
        "is_processed": filename in vector_stores,
        "filename": filename
    }

@app.post("/upload")
async def upload_pdf(file: UploadFile):
    if not llm:
        raise HTTPException(status_code=503, detail="LLM not initialized")
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        # Process PDF
        texts = process_pdf(temp_path)
        
        # Create vector store for this specific file
        vector_stores[file.filename] = FAISS.from_texts(texts, embeddings)
        
        # Clean up temp file
        os.unlink(temp_path)
        
        return {"message": "PDF processed successfully", "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query")
async def query_document(request: QueryRequest):
    if not llm:
        raise HTTPException(status_code=503, detail="LLM not initialized")
    
    if request.filename not in vector_stores:
        raise HTTPException(
            status_code=400, 
            detail=f"Document {request.filename} has not been processed yet"
        )
    
    try:
        # Use custom prompt if provided, otherwise use default
        prompt_template = PromptTemplate(
            template=request.custom_prompt if request.custom_prompt else DEFAULT_PROMPT,
            input_variables=["context", "question"]
        )
        
        # Create QA chain with custom prompt
        qa_chain = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=vector_stores[request.filename].as_retriever(search_kwargs={"k": 3}),
            chain_type_kwargs={"prompt": prompt_template}
        )
        
        # Get response
        response = qa_chain.run(request.question)
        
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)