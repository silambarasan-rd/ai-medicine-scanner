'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  executeChatQuery,
  saveChatMessage,
  loadChatHistory,
  updateMessageWithActionResult,
  ChatMessage,
  ChatSession,
  createNewSession,
  loadUserSessions,
  executeTool
} from '@/app/lib/chatbot-engine';
import { findTool } from '@/app/lib/mcp-tools';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import ChatResultsCard from '@/app/components/ChatResultsCard';
import styles from './page.module.css';

interface ConfirmationAction {
  messageId: string;
  tool: string;
  params: Record<string, unknown>;
  description: string;
}

interface MessageWithResults extends ChatMessage {
  results?: Record<string, unknown>;
}

export default function ChatbotPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [userId, setUserId] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [confirmingAction, setConfirmingAction] = useState<ConfirmationAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize user and load sessions
  useEffect(() => {
    const initUser = async () => {
      try {
        // Get current user
        const userResponse = await fetch('/api/profile');
        if (!userResponse.ok) {
          router.push('/login');
          return;
        }

        const userData = await userResponse.json();
        setUserId(userData.id);

        // Load all sessions
        const userSessions = await loadUserSessions(userData.id);
        setSessions(userSessions);

        // Start with most recent session or create new one
        if (userSessions.length > 0) {
          const mostRecent = userSessions[0];
          setSessionId(mostRecent.id);
          const history = await loadChatHistory(userData.id, mostRecent.id);
          setMessages(history);
        } else {
          // No sessions exist, create new one
          const newSessionId = createNewSession();
          setSessionId(newSessionId);
          setMessages([]);
        }
      } catch (error) {
        console.error('Error initializing user:', error);
        router.push('/login');
      }
    };

    initUser();
  }, [router]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Create a new chat session
   */
  const handleNewChat = () => {
    const newSessionId = createNewSession();
    setSessionId(newSessionId);
    setMessages([]);
    setInput('');
  };

  /**
   * Switch to an existing session
   */
  const handleSwitchSession = async (session: ChatSession) => {
    if (session.id === sessionId) return; // Already on this session
    
    setSessionId(session.id);
    setMessages([]);
    setLoading(true);
    
    try {
      const history = await loadChatHistory(userId, session.id);
      setMessages(history);
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh sessions list (call after sending message)
   */
  const refreshSessions = async () => {
    if (!userId) return;
    const userSessions = await loadUserSessions(userId);
    setSessions(userSessions);
  };

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
        // Save with proposed action, wait for confirmation (write operations)
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
        // For read-only operations or simple responses, save with results
        assistantMessage = await saveChatMessage(
          userId, 
          sessionId, 
          'assistant', 
          result.response,
          undefined, // no actionProposed for read-only operations
          result.results // save results to database for persistence
        );
      }

      setMessages(prev => [...prev, assistantMessage]);
      
      // Refresh sessions list to update preview
      await refreshSessions();
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

      // Save confirmation response with collapsible payload
      const confirmationMessage = await saveChatMessage(
        userId,
        sessionId,
        'assistant',
        `✓ Action completed successfully! ${confirmingAction.tool} has been executed.`,
        undefined,
        { payload: confirmingAction.params, tool: confirmingAction.tool }
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
      {/* Sidebar */}
      <div className={`${styles.sidebar} ${showSidebar ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <h2>Chat History</h2>
          <button 
            className={styles.toggleBtn}
            onClick={() => setShowSidebar(!showSidebar)}
            title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
          >
            {showSidebar ? '◀' : '▶'}
          </button>
        </div>
        
        <button className={styles.newChatBtn} onClick={handleNewChat}>
          + New Chat
        </button>
        
        <div className={styles.sessionsList}>
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`${styles.sessionItem} ${session.id === sessionId ? styles.sessionActive : ''}`}
              onClick={() => handleSwitchSession(session)}
            >
              <div className={styles.sessionPreview}>
                {session.preview || 'New chat'}
              </div>
              <div className={styles.sessionMeta}>
                {session.messageCount || 0} messages • {new Date(session.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className={styles.noSessions}>No chat history yet</div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={styles.mainContent}>
        {/* Header */}
        <div className={styles.header}>
          {!showSidebar && (
            <button 
              className={styles.menuBtn}
              onClick={() => setShowSidebar(true)}
              title="Show chat history"
            >
              ☰
            </button>
          )}
          <div>
            <h1>AI Medicine Assistant</h1>
            <p>Ask me to manage your medicines, pharmacy inventory, or find hospitals</p>
          </div>
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

              {/* Show results cards if available */}
              {(msg as MessageWithResults).results && (
                <ChatResultsCard
                  type={(msg as MessageWithResults).results?.type as string}
                  items={((msg as MessageWithResults).results?.items || []) as Array<Record<string, unknown>>}
                  total={(msg as MessageWithResults).results?.total as number}
                  viewAllUrl={(msg as MessageWithResults).results?.viewAllUrl as string | undefined}
                />
              )}

              {/* Show inline confirmation if action is pending */}
              {msg.actionProposed && !msg.actionConfirmed && msg.id === confirmingAction?.messageId && (
                <div className={styles.inlineConfirmation}>
                  <div className={styles.confirmHeader}>
                    <strong>⚠️ Confirmation Required</strong>
                  </div>
                  <p className={styles.confirmDescription}>{msg.actionProposed.description}</p>
                  <details className={styles.paramsDetails}>
                    <summary>View parameters</summary>
                    <pre className={styles.paramsJson}>{JSON.stringify(msg.actionProposed.params, null, 2)}</pre>
                  </details>
                  <div className={styles.confirmButtons}>
                    <button
                      className={`${styles.button} ${styles.confirmBtn}`}
                      onClick={handleConfirmAction}
                      disabled={executingAction}
                    >
                      {executingAction ? '⏳ Executing...' : '✓ Confirm & Execute'}
                    </button>
                    <button
                      className={`${styles.button} ${styles.cancelBtn}`}
                      onClick={handleCancelAction}
                      disabled={executingAction}
                    >
                      ✗ Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Show action payload if this is a confirmation message */}
              {msg.actionResult && typeof msg.actionResult === 'object' && 'payload' in msg.actionResult && (
                <details className={styles.payloadDetails}>
                  <summary>View action details</summary>
                  <div className={styles.payloadContent}>
                    <div className={styles.payloadTool}>
                      <strong>Tool:</strong> {String((msg.actionResult as { tool?: string }).tool || '')}
                    </div>
                    <div className={styles.payloadParams}>
                      <strong>Parameters:</strong>
                      <pre>{JSON.stringify((msg.actionResult as { payload?: unknown }).payload, null, 2)}</pre>
                    </div>
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form className={styles.inputForm} onSubmit={handleSendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about your medicines..."
          disabled={loading}
          className={styles.input}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className={styles.sendButton}
        >
          {loading ? 'Thinking...' : 'Send'}
        </button>
      </form>
      </div>
    </div>
  );
}
