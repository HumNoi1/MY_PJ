from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import numpy as np
import torch
import pypdf
import tempfile
import os
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the model
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
if torch.cuda.is_available():
    model = model.to('cuda')

def get_embeddings(texts: List[str]) -> List[float]:
    """Generate embeddings for a list of texts."""
    try:
        with torch.no_grad():
            embeddings = model.encode(texts, convert_to_tensor=True)
            if torch.cuda.is_available():
                embeddings = embeddings.cpu()
            # Calculate mean embedding if multiple texts
            mean_embedding = torch.mean(embeddings, dim=0)
            return mean_embedding.numpy().tolist()
    except Exception as e:
        raise Exception(f"Error generating embeddings: {str(e)}")

@app.post("/process-pdf")
async def process_pdf(file: UploadFile):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        try:
            # Extract text from PDF
            pdf_reader = pypdf.PdfReader(temp_path)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text()

            # Split text into chunks
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len,
            )
            texts = text_splitter.split_text(text)
            
            # Generate embedding
            embedding = get_embeddings(texts)

            # Clean up
            os.unlink(temp_path)

            return {
                "text": "\n".join(texts),
                "embedding": embedding,
                "chunks": len(texts),
                "total_length": len(text)
            }

        except Exception as e:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise HTTPException(
                status_code=400,
                detail=f"Error processing PDF: {str(e)}"
            )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Server error while processing PDF: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)