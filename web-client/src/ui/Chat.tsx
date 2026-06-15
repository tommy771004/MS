import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

/** Chat box (DOM). Typing here is ignored by the game input (focus guard). */
export function Chat() {
  const chat = useGameStore((s) => s.chat);
  const addChat = useGameStore((s) => s.addChat);
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    addChat('我', trimmed);
    setText('');
  };

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef}>
        {chat.map((m) => (
          <div key={m.id} className={`chat-line ${m.system ? 'system' : ''}`}>
            <b>{m.author}:</b> {m.text}
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="輸入訊息後按 Enter…"
          maxLength={80}
        />
      </form>
    </div>
  );
}
