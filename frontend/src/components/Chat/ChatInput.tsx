import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import {
  PaperAirplaneIcon,
  FaceSmileIcon,
  PaperClipIcon,
  BoltIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  DocumentTextIcon,
  XMarkIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { savedResponsesApi, templatesApi, mediaApi } from '../../api/client';
import { useWorkspaceStore } from '../../store/workspace';
import { SavedResponse } from '../../types';

interface MediaAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface Props {
  onSend: (content: string, isNote?: boolean, media?: MediaAttachment) => Promise<void>;
  onTyping?: () => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, onTyping, disabled }: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplies, setQuickReplies] = useState<SavedResponse[]>([]);
  const [qrSearch, setQrSearch] = useState('');
  const [loadingQR, setLoadingQR] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [attachment, setAttachment] = useState<MediaAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const templatePopoverRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace } = useWorkspaceStore();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = await mediaApi.upload(file);
      setAttachment(r.data);
    } catch (err) {
      alert('File upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowQuickReplies(false);
      }
    };
    if (showQuickReplies) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showQuickReplies]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (templatePopoverRef.current && !templatePopoverRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    };
    if (showTemplates) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTemplates]);

  const openTemplates = async () => {
    if (!currentWorkspace) return;
    setShowTemplates(true);
    setTemplateSearch('');
    setLoadingTpl(true);
    try {
      const { data } = await templatesApi.list(currentWorkspace.id);
      setTemplates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTpl(false);
    }
  };

  const openQuickReplies = async () => {
    if (!currentWorkspace) return;
    setShowQuickReplies(true);
    setQrSearch('');
    setLoadingQR(true);
    try {
      const { data } = await savedResponsesApi.list(currentWorkspace.id);
      setQuickReplies(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingQR(false);
    }
  };

  const insertResponse = (text: string) => {
    setContent((prev) => prev ? prev + '\n' + text : text);
    setShowQuickReplies(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        textareaRef.current.focus();
      }
    }, 0);
  };

  const filteredQR = quickReplies.filter(
    (r) =>
      !qrSearch ||
      r.title.toLowerCase().includes(qrSearch.toLowerCase()) ||
      r.content.toLowerCase().includes(qrSearch.toLowerCase())
  );

  const handleSend = async () => {
    const text = content.trim();
    if ((!text && !attachment) || sending || disabled) return;
    setSending(true);
    const currentAttachment = attachment;
    setContent('');
    setAttachment(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    try {
      await onSend(text || (currentAttachment?.name || 'File'), noteMode, currentAttachment || undefined);
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
    onTyping?.();
  };

  const isNote = noteMode;
  const borderClass = isNote ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50';

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-3">
      {/* Note mode banner */}
      {isNote && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <LockClosedIcon className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-medium text-amber-600">Internal note — only visible to your team</span>
          <button
            onClick={() => setNoteMode(false)}
            className="ml-auto text-xs text-amber-500 hover:text-amber-700 underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Attachment preview */}
      {attachment && (
        <div className="flex items-center gap-2 mb-2 px-1 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
          {attachment.type.startsWith('image/') ? (
            <PhotoIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
          ) : (
            <PaperClipIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
          )}
          <span className="text-xs text-blue-700 font-medium truncate flex-1">{attachment.name}</span>
          <span className="text-xs text-blue-500 flex-shrink-0">{(attachment.size / 1024).toFixed(0)} KB</span>
          <button onClick={() => setAttachment(null)} className="text-blue-400 hover:text-blue-600">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.mp3,.ogg"
      />

      <div className={`flex items-end gap-3 rounded-xl border px-4 py-3 transition-colors ${borderClass}`}>
        <div className="flex gap-2 pb-0.5 relative" ref={popoverRef}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
            title="Attach file"
          >
            {uploading ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <PaperClipIcon className="w-5 h-5" />}
          </button>
          <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Emoji">
            <FaceSmileIcon className="w-5 h-5" />
          </button>
          {/* Quick replies */}
          <button
            onClick={openQuickReplies}
            disabled={disabled || isNote}
            className="text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-40"
            title="Quick replies"
          >
            <BoltIcon className="w-5 h-5" />
          </button>
          {/* WA Templates */}
          <div className="relative" ref={templatePopoverRef}>
            <button
              onClick={openTemplates}
              disabled={disabled || isNote}
              className="text-gray-400 hover:text-green-600 transition-colors disabled:opacity-40"
              title="WhatsApp Templates"
            >
              <DocumentTextIcon className="w-5 h-5" />
            </button>
            {showTemplates && (
              <div className="absolute bottom-10 left-0 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="p-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">WA Templates</p>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      autoFocus
                      className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {loadingTpl ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : templates.filter(t => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase())).length === 0 ? (
                    <div className="py-6 text-center text-sm text-gray-500">
                      {templates.length === 0 ? 'No templates yet. Add in Settings → Templates.' : 'No matches'}
                    </div>
                  ) : (
                    templates
                      .filter(t => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { insertResponse(t.content); setShowTemplates(false); }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                            <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full flex-shrink-0">{t.category}</span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">{t.content}</p>
                        </button>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Note mode toggle */}
          <button
            onClick={() => setNoteMode((v) => !v)}
            disabled={disabled}
            title="Add internal note"
            className={`transition-colors disabled:opacity-40 ${isNote ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
          >
            <LockClosedIcon className="w-5 h-5" />
          </button>

          {/* Quick replies popover */}
          {showQuickReplies && (
            <div className="absolute bottom-10 left-0 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Replies</p>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Search responses..."
                    value={qrSearch}
                    onChange={(e) => setQrSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {loadingQR ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredQR.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500">
                    {quickReplies.length === 0 ? (
                      <span>No saved responses yet.<br />
                        <span className="text-xs">Add them in Settings → Saved Responses</span>
                      </span>
                    ) : 'No matches found'}
                  </div>
                ) : (
                  filteredQR.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => insertResponse(r.content)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                        {r.category && (
                          <span className="text-[10px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full flex-shrink-0">
                            {r.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">{r.content}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled ? 'Select a conversation to start messaging...' :
            isNote ? 'Write an internal note visible only to your team...' :
            'Type a message... (Enter to send, Shift+Enter for new line)'
          }
          disabled={disabled || sending}
          rows={1}
          className="flex-1 bg-transparent resize-none text-sm text-gray-900 placeholder-gray-400 focus:outline-none max-h-[120px] overflow-y-auto"
          style={{ minHeight: '24px' }}
        />
        <button
          onClick={handleSend}
          disabled={(!content.trim() && !attachment) || sending || disabled}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all ${
            isNote ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary-600 hover:bg-primary-700'
          }`}
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <PaperAirplaneIcon className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5 text-center">
        Enter to send · Shift+Enter new line · ⚡ quick replies · 🔒 internal note
      </p>
    </div>
  );
}
