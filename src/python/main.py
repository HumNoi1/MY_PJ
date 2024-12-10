from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_community.llms import LlamaCpp
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain_community.vectorstores.supabase import SupabaseVectorStore
from supabase.client import Client, create_client
import pypdf
import tempfile
import os
from typing import List, Dict, Optional
from pydantic import BaseModel

class GradingSystem:
    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        model_path: str,
        table_name: str = "documents"
    ):
        # Initialize Supabase
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.table_name = table_name
        
        # Initialize LLM
        callback_manager = CallbackManager([StreamingStdOutCallbackHandler()])
        self.llm = LlamaCpp(
            model_path=model_path,
            temperature=0.2,  # Lower temperature for more consistent grading
            max_tokens=2000,
            n_ctx=2048,
            n_threads=8,
            n_gpu_layers=1,
            callback_manager=callback_manager,
            verbose=True,
        )
        
        # Initialize embeddings
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cuda'}
        )

    def process_pdf(self, file_path: str) -> List[str]:
        """Extract and split PDF content."""
        try:
            pdf_reader = pypdf.PdfReader(file_path)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text()
            
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len,
            )
            return splitter.split_text(text)
        except Exception as e:
            raise Exception(f"Error processing PDF: {str(e)}")

    async def store_teacher_answer(self, file_path: str, class_id: str) -> str:
        """Process and store teacher's answer in Supabase."""
        try:
            # Process PDF
            texts = self.process_pdf(file_path)
            
            # Create vector store
            vector_store = SupabaseVectorStore(
                self.supabase,
                self.embeddings,
                table_name=self.table_name,
                query_name="match_documents",
                similarity_threshold=0.5
            )
            
            # Store documents with metadata
            vector_store.add_texts(
                texts=texts,
                metadatas=[{
                    "class_id": class_id,
                    "type": "teacher_answer"
                }] * len(texts)
            )
            
            return "Teacher's answer stored successfully"
        except Exception as e:
            raise Exception(f"Error storing teacher's answer: {str(e)}")

    async def grade_student_answer(
        self,
        student_pdf_path: str,
        class_id: str,
        grading_criteria: Dict[str, int]
    ) -> Dict:
        """Grade student's answer using stored teacher's answer as reference."""
        try:
            # Extract student's answer
            student_text = "\n".join(self.process_pdf(student_pdf_path))
            
            # Create vector store for retrieval
            vector_store = SupabaseVectorStore(
                self.supabase,
                self.embeddings,
                table_name=self.table_name,
                query_name="match_documents",
                similarity_threshold=0.5
            )
            
            # Create grading prompt
            grading_prompt = PromptTemplate(
                template="""You are a professional teacher grading a student's answer.
                Use the following teacher's answer as reference to grade the student's work.
                
                Grading Criteria:
                {criteria}
                
                Teacher's Answer:
                {context}
                
                Student's Answer:
                {student_answer}
                
                Provide a detailed evaluation following this format:
                SCORES:
                - Criteria 1: [score]/[max] - [explanation]
                - Criteria 2: [score]/[max] - [explanation]
                ...
                Total Score: [total]/[max_total]
                
                FEEDBACK:
                [Detailed feedback and suggestions for improvement]
                """,
                input_variables=["context", "student_answer", "criteria"]
            )
            
            # Create QA chain
            qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                chain_type="stuff",
                retriever=vector_store.as_retriever(
                    search_kwargs={
                        "filter": {"class_id": class_id, "type": "teacher_answer"},
                        "k": 3
                    }
                ),
                chain_type_kwargs={"prompt": grading_prompt}
            )
            
            # Get grading result
            result = qa_chain.run({
                "student_answer": student_text,
                "criteria": "\n".join([f"- {k}: {v} points" for k, v in grading_criteria.items()])
            })
            
            return {
                "grading_result": result,
                "student_answer": student_text
            }
            
        except Exception as e:
            raise Exception(f"Error grading student's answer: {str(e)}")

# FastAPI Implementation
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize grading system
grader = None

@app.on_event("startup")
async def startup_event():
    global grader
    try:
        grader = GradingSystem(
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_key=os.getenv("SUPABASE_KEY"),
            model_path="models/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
            table_name="documents"
        )
    except Exception as e:
        print(f"Error initializing grading system: {str(e)}")

class GradingRequest(BaseModel):
    class_id: str
    criteria: Dict[str, int]

@app.post("/store-teacher-answer")
async def store_teacher_answer(file: UploadFile, class_id: str):
    if not grader:
        raise HTTPException(status_code=503, detail="Grading system not initialized")
    
    try:
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        result = await grader.store_teacher_answer(temp_path, class_id)
        os.unlink(temp_path)
        return {"message": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/grade-student-answer")
async def grade_student_answer(
    file: UploadFile,
    request: GradingRequest
):
    if not grader:
        raise HTTPException(status_code=503, detail="Grading system not initialized")
    
    try:
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        result = await grader.grade_student_answer(
            temp_path,
            request.class_id,
            request.criteria
        )
        os.unlink(temp_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
@app.post("/grade-answer")
async def grade_answer(
  student_file: UploadFile,
  answer_key_id: str,
  grading_criteria: Dict[str, int]  
):
    if not grader:
        raise HTTPException(status_code=503, detail="Grading system not initialized")
    
    try:
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            content = await student_file.read()
            temp_file.write(content)
            temp_path = temp_file.name
    
        result = await grader.grade_student_answer(
            temp_path,
            answer_key_id,
            grading_criteria
        )
        os.unlink(temp_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))