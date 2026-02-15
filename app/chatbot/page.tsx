'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  executeChatQuery,
  saveChatMessage,
  loadChatHistory,
  updateMessageWithActionResult,
  ChatMessage,
  createNewSession,
  executeTool
} from '@/app/lib/chatbot-engine';
import { findTool } from '@/app/lib/mcp-tools';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import styles from './page.module.css';

interface ConfirmationAction {
  messageId: string;
  tool: string;
  params: Record<string, unknown>;
  description: string;
}

export default function ChatbotPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [userId, setUserId] = useState('');
  const [confirmingAction, setConfirmingAction] = useState<ConfirmationAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize session and load history
  useEffect(() => {
    const initSession = async () => {
      try {
        // Get current user
        const userResponse = await fetch('/api/profile');
        if (!userResponse.ok) {
          router.push('/login');
          return;
        }

        const userData = await userResponse.json();
        setUserId(userData.id);

        // Create or load session
        const newSessionId = createNewSession();
        setSessionId(newSessionId);

        // Load chat history
        const history = await loadChatHistory(userData.id, newSessionId);
        setMessages(history);
      } catch (error) {
        console.error('Error initializing session:', error);
        router.push('/login');
      }
    };

    initSession();
  }, [router]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Handle user sending a message
   */
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || loading || !sessionId || !userId) return;

    const userInput = input.trim();
    setInput('');
    setLoading(true);

    try {
      // Save user message
      const userMessage = await saveChatMessage(userId, sessionId, 'user', userInput);
      setMessages(prev => [...prev, userMessage]);

      // Get AI response
      const result = await executeChatQuery(userInput, sessionId, messages);

      // Determine if we should immediately save the AI response or wait for confirmation
      let assistantMessage: ChatMessage;

      if (result.actionProposed && findTool(result.actionProposed.tool)?.requiresConfirmation) {
        // Save with proposed action, wait for confirmation
        assistantMessage = await saveChatMessage(
          userId,
          sessionId,
          'assistant',
          result.response,
          result.actionProposed
        );

        // Show confirmation modal
        setConfirmingAction({
          messageId: assistantMessage.id,
          tool: result.actionProposed.tool,
          params: result.actionProposed.params,
          description: result.actionProposed.description
        });
      } else {
        // For read-only operations, just save the response
        assistantMessage = await saveChatMessage(userId, sessionId, 'assistant', result.response);
      }

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Save error message
      const errorMessage = await saveChatMessage(
        userId,
        sessionId,
        'assistant',
        'Sorry, there was an error processing your request. Please try again.'
      );
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle user confirming an action
   */
  const handleConfirmAction = async () => {
    if (!confirmingAction) return;

    setExecutingAction(true);
    try {
      // Execute the tool
      const result = await executeTool(confirmingAction.tool, confirmingAction.params);

      // Update message with result
      await updateMessageWithActionResult(confirmingAction.messageId, true, result);

      // Update local state
      setMessages(prev =>
        prev.map(msg =>
          msg.id === confirmingAction.messageId
            ? { ...msg, actionConfirmed: true, actionResult: result }
            : msg
        )
      );

      // Save confirmation response
      const confirmationMessage = await saveChatMessage(
        userId,
        sessionId,
        'assistant',
        `✓ Action completed successfully! ${confirmingAction.tool} has been executed.`
      );
      setMessages(prev => [...prev, confirmationMessage]);

      setConfirmingAction(null);
    } catch (error) {
      console.error('Error executing action:', error);

      // Save error message
      const errorMessage = await saveChatMessage(
        userId,
        sessionId,
        'assistant',
        `Error executing action: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setMessages(prev => [...prev, errorMessage]);

      setConfirmingAction(null);
    } finally {
      setExecutingAction(false);
    }
  };

  /**
   * Handle user canceling an action
   */
  const handleCancelAction = async () => {
    if (!confirmingAction) return;

    // Save cancellation message
    const cancelMessage = await saveChatMessage(
      userId,
      sessionId,
      'assistant',
      'Action cancelled. How else can I help you?'
    );
    setMessages(prev => [...prev, cancelMessage]);

    setConfirmingAction(null);
  };

  if (!sessionId) {
    return (
      <div className={styles.container}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>AI Medicine Assistant</h1>
        <p>Ask me to manage your medicines, pharmacy inventory, or find hospitals</p>
      </div>

      {/* Chat Messages */}
      <div className={styles.messagesContainer}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <h2>Welcome to your AI Assistant! 👋</h2>
            <p>Try asking:</p>
            <ul>
              <li>Add aspirin 500mg twice daily</li>
              <li>List my scheduled medicines</li>
              <li>Add medicine to my pharmacy with 10 bottles in stock</li>
              <li>Show hospitals in my district</li>
              <li>Record that I took my medicine today</li>
            </ul>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={msg.id || idx} className={`${styles.message} ${styles[msg.role]}`}>
            <div className={styles.messageContent}>
              <div className={styles.messageText}>{msg.content}</div>

              {/* Show action if confirmed */}
              {msg.actionConfirmed && msg.actionResult && (
                <div className={styles.actionResult}>
                  <strong>✓ Executed:</strong> {msg.actionProposed?.tool}
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Confirmation Modal */}
      {confirmingAction && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>Confirm Action</h3>
            <p className={styles.modalDescription}>{confirmingAction.description}</p>

            <div className={styles.paramsList}>
              <h4>Parameters:</h4>
              <pre>{JSON.stringify(confirmingAction.params, null, 2)}</pre>
            </div>

            <div className={styles.modalButtons}>
              <button
                className={`${styles.button} ${styles.confirmBtn}`}
                onClick={handleConfirmAction}
                disabled={executingAction}
              >
                {executingAction ? 'Executing...' : 'Confirm & Execute'}
              </button>
              <button
                className={`${styles.button} ${styles.cancelBtn}`}
                onClick={handleCancelAction}
                disabled={executingAction}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Form */}
      <form className={styles.inputForm} onSubmit={handleSendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about your medicines..."
          disabled={loading || !!confirmingAction}
          className={styles.input}
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || !!confirmingAction}
          className={styles.sendButton}
        >
          {loading ? 'Thinking...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
