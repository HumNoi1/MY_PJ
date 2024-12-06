from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from llama_cpp import Llama
import os

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Llama model
model_path = "models/llama-2-7b-chat.gguf"  # Update with your model path
llm = Llama(
    model_path=model_path,
    n_ctx=2048,  # Context window
    n_threads=4   # Number of CPU threads to use
)

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        # Generate response from Llama
        response = llm.create_completion(
            request.message,
            max_tokens=200,
            temperature=0.7,
            top_p=0.95,
            stop=["User:", "\n"],
            echo=False
        )
        
        return {"response": response['choices'][0]['text'].strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)