/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI} from '@google/genai';
import {useEffect, useState} from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

    const generateGreeting = async () => {
      const response = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: 'Write a friendly greeting with a 😊',
      });

      let greeting = '';
      for await (const chunk of response) {
        greeting += chunk.text;
      }
      setMessage(greeting);
    };

    generateGreeting();
  }, []);

  return (
    <div>
      <h1>{message}</h1>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
