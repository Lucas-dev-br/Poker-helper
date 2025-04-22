// poker-helper-app - com status de gravação, pausa, contador e feedback visual
import { useRef, useState, useEffect } from 'react';
import './App.css';

function App() {
  const [image, setImage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | undefined>();

  const [isRecording, setIsRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const timerRef = useRef<any | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    const brazilianVoice = voices.find(v => v.lang === 'pt-BR' && v.name.toLowerCase().includes('female'))
      || voices.find(v => v.lang === 'pt-BR');
    setVoice(brazilianVoice);
  }, []);

  const startTimer = () => {
    setRecordTime(0);
    timerRef.current = setInterval(() => {
      setRecordTime(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
    setRecordTime(0);
  };

  const handleStartVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Seu navegador não suporta reconhecimento de voz.");

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      stopTimer();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);
      setRecorded(true);
    };

    recognition.onerror = (event: any) => {
      console.error('Erro:', event.error);
      setIsRecording(false);
      stopTimer();
    };

    recognition.onend = () => {
      setIsRecording(false);
      stopTimer();
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    setRecorded(false);
    startTimer();
  };

  const speakText = (text: any) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.5;
    utterance.pitch = 1.1;
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  const generatePrompt = () => {
    return `Tenho ${hand} na posição ${position} com ${heroStack} BB. O big blind tem ${bbStack} BB. ${situation}`;
  };

  const [hand, setHand] = useState('');
  const [position, setPosition] = useState('');
  const [heroStack, setHeroStack] = useState('');
  const [bbStack, setBBStack] = useState('');
  const [situation, setSituation] = useState('');

  const handleAnalyze = async () => {
    setLoading(true);
    setResponse('');

    const finalPrompt = transcript || generatePrompt();

    const formData = new FormData();
    if (image) {
      const fileBlob = await fetch(image).then(r => r.blob());
      formData.append("image", fileBlob, "hand.png");
    }
    formData.append("prompt", finalPrompt);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: image ? "gpt-4-vision-preview" : "gpt-4",
          messages: [
            {
              role: "user",
              content: image ? [
                {
                  type: "text",
                  text: `Você é um assistente de poker profissional. Analise a imagem da mão e considere também os seguintes dados adicionais: ${finalPrompt}.

Dê uma resposta direta e técnica com a melhor jogada (fold, call, raise, all-in), explicando rapidamente a razão com base em ranges de push/fold e expectativa de vitória.`
                },
                { type: "image_url", image_url: { url: image } }
              ] : `Você é um assistente de poker profissional. A situação é: ${finalPrompt}. 
Diga a jogada ideal (fold, call, raise, all-in) de forma direta com a maior expectativa de vitória, considerando ranges padrão e ICM se necessário.`
            }
          ],
          max_tokens: 300
        })
      });

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || 'Nenhuma resposta.';
      setResponse(text);
      speakText(text);
    } catch (err) {
      console.error(err);
      setResponse("Erro ao conectar com a API da OpenAI.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="bg-gray-950 p-6 rounded-xl shadow-lg w-full max-w-xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-green-400">Assistente de Poker 🎯</h1>

        <div className="flex flex-col gap-4">
          {/* <label className="text-sm text-gray-400">📤 Envie a imagem da sua mão:</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
          /> */}

          <button
            onClick={handleStartVoice}
            className={`py-2 rounded font-semibold ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-black`}
          >
            {isRecording ? '⏸️ Parar Gravação' : '🎤 Falar Situação'}
          </button>

          {isRecording && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <span>🎙️ Gravando... {recordTime}s</span>
              <div className="h-3 w-1 bg-green-400 animate-wave"></div>
              <div className="h-4 w-1 bg-green-400 animate-wave delay-100"></div>
              <div className="h-2 w-1 bg-green-400 animate-wave delay-200"></div>
            </div>
          )}

          {recorded && !isRecording && (
            <div className="text-sm text-yellow-400">✅ Áudio gravado com sucesso</div>
          )}

          <label className="text-sm text-gray-400">✍️ Ou preencha abaixo para gerar a descrição:</label>
          <input type="text" placeholder="Sua mão (ex: A9s)" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded" value={hand} onChange={e => setHand(e.target.value)} />
          <input type="text" placeholder="Posição (ex: botão, SB, BB)" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded" value={position} onChange={e => setPosition(e.target.value)} />
          <input type="text" placeholder="Seu stack (BB)" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded" value={heroStack} onChange={e => setHeroStack(e.target.value)} />
          <input type="text" placeholder="Stack do BB (BB)" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded" value={bbStack} onChange={e => setBBStack(e.target.value)} />
          <input type="text" placeholder="Situação adicional (ex: pré-flop, todos foldaram)" className="px-3 py-2 bg-gray-800 border border-gray-700 rounded" value={situation} onChange={e => setSituation(e.target.value)} />

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-black font-bold py-2 rounded disabled:opacity-50"
          >
            🔍 Analisar Jogada
          </button>

          {image && (
            <img
              src={image}
              alt="Mão de poker"
              className="rounded-lg border border-gray-700 shadow mt-4"
            />
          )}

          {loading && <p className="text-sm text-gray-400 text-center">Analisando imagem e situação...</p>}

          {response && (
            <div className="bg-gray-800 p-4 rounded-lg shadow mt-4 border border-green-500">
              <h2 className="font-semibold text-green-400 mb-2">💡 Resposta do Assistente:</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{response}</p>
              <button
                onClick={() => speakText(response)}
                className="mt-4 bg-green-500 hover:bg-green-600 text-black px-4 py-2 rounded text-sm"
              >
                🔊 Ouvir novamente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
