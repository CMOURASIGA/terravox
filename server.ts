import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini API
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // API Routes
  app.post('/api/generate-questions', async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
      }

      const { territory, theme, difficulty, count = 3 } = req.body;

      const prompt = `
        Gere ${count} perguntas de múltipla escolha para um jogo estilo RPG educativo, focadas no território "${territory}" e tema "${theme}".
        A dificuldade deve ser ${difficulty} (onde 1 é fácil para crianças de 10 anos e 5 é difícil para adultos).
        As perguntas devem ser um mix de conhecimentos gerais e escolares (Geografia, História, Cultura, Ciências).
        
        Siga ESTRITAMENTE a seguinte estrutura JSON para a resposta, retornando APENAS um array de objetos:
        [
          {
            "id": "q1",
            "prompt": "Texto da pergunta aqui?",
            "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
            "correct_answer": "Opção 1",
            "explanation": "Explicação curta de por que essa é a resposta correta."
          }
        ]
        
        Lembre-se de retornar APENAS o JSON válido, sem crases de formatação markdown adicionais fora do array se possível, ou se usar, retorne um json limpo que possa ser parseado com JSON.parse().
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json'
        }
      });

      const text = response.text();
      let questions = [];
      if (text) {
          try {
             questions = JSON.parse(text);
          } catch(e) {
             console.error("Failed to parse JSON from Gemini:", text);
             return res.status(500).json({ error: 'Failed to generate valid questions' });
          }
      }

      res.json({ questions });
    } catch (error) {
      console.error('Error generating questions:', error);
      res.status(500).json({ error: 'Failed to generate questions' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
