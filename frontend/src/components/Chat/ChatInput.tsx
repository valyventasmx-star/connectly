import { useState, useRef, KeyboardEvent } from 'react';
import { PaperAirplaneIcon, FaceSmileIcon, PaperClipIcon } from '@heroicons/react/24/outline';

interface Props {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const text = content.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    try {
      await onSend(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-3">
      <div className="flex items-end gap-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
        <div className="flex gap-2 pb-0.5">
          <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Attach file">
            <PaperClipIcon className="w-5 h-5" />
          </button>
          <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Emoji">
            <FaceSmileIcon className="w-5 h-5" />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a conversation to start messaging...' : 'Type a message... (Enter to send, Shift+Enter for new line)'}
          disabled={disabled || sending}
          rows={1}
          className="flex-1 bg-transparent resize-none text-sm text-gray-900 placeholder-gray-400 focus:outline-none max-h-[120px] overflow-y-auto"
          style={{ minHeight: '24px' }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending || disabled}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <PaperAirplaneIcon className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 text-center">Press Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
