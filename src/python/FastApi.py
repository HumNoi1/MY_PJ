async def get_pdf_content(supabase_client, file_path):
    try:
        # ดึงไฟล์จาก Storage
        response = await supabase_client.storage.from('teacher-resources').download(file_path)
        
        # แปลงเป็น BytesIO และอ่านด้วย PyPDF2
        pdf_content = ""
        pdf_reader = PyPDF2.PdfReader(BytesIO(response))
        for page in pdf_reader.pages:
            pdf_content += page.extract_text()
            
        return pdf_content
    except Exception as e:
        raise Exception(f"Error reading PDF: {str(e)}")
    
async def store_embeddings(supabase_client, text_chunks, file_metadata):
    try:
        # สร้าง embeddings ด้วย sentence-transformers
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        
        # เก็บใน Supabase pgvector
        for chunk in text_chunks:
            embedding = embeddings.embed_query(chunk)
            await supabase_client.rpc(
                'store_document', 
                {
                    'content': chunk,
                    'embedding': embedding,
                    'metadata': json.dumps(file_metadata)
                }
            )
    except Exception as e:
        raise Exception(f"Error storing embeddings: {str(e)}")

async def query_documents(supabase_client, question, llm):
    try:
        # สร้าง embedding สำหรับคำถาม
        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        question_embedding = embeddings.embed_query(question)
        
        # ค้นหาเอกสารที่เกี่ยวข้อง
        matches = await supabase_client.rpc(
            'match_documents',
            {
                'query_embedding': question_embedding,
                'match_count': 3
            }
        )
        
        # สร้างบริบทจากเอกสารที่เจอ
        context = "\n".join([match['content'] for match in matches])
        
        # สร้าง prompt
        prompt = f"""ใช้บริบทต่อไปนี้เพื่อตอบคำถาม:

        บริบท:
        {context}

        คำถาม:
        {question}

        คำตอบ:"""
        
        # ใช้ LLM จาก LMStudio ตอบคำถาม
        response = llm(prompt)
        
        return response
        
    except Exception as e:
        raise Exception(f"Error querying documents: {str(e)}")

@app.post("/query")
async def query_endpoint(request: QueryRequest):
    try:
        # เชื่อมต่อกับ LMStudio
        llm = LlamaCpp(
            model_path="models/llama2.gguf",
            temperature=0.1,
            max_tokens=512,
            context_window=2048,
            n_gpu_layers=1
        )
        
        # ดำเนินการค้นหาและถามคำถาม
        response = await query_documents(supabase, request.question, llm)
        
        return {"response": response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))