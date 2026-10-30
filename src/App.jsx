import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowUpRight, BarChart3, Bot, Check, ChevronDown,
  CircleHelp, Clock3, Command, CreditCard, Database, Gauge, Menu, MessageSquare,
  MoreHorizontal, Plus, RefreshCw, Send, Settings2, ShieldCheck, Sparkles,
  TrendingUp, X, Zap,
} from 'lucide-react';
import { ApiError, generateResponse, getQuotaHistory, getQuotaStatus, upgradePlan } from './api.js';

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const pick = (object, keys) => {
  for (const key of keys) if (object?.[key] !== undefined && object?.[key] !== null) return object[key];
  return null;
};
const formatNumber = (value) => value === null ? '—' : new Intl.NumberFormat('en-US').format(value);
const estimateTokens = (text) => text.trim() ? Math.max(1, Math.ceil(text.trim().length / 4)) : 0;

function App() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryUntil, setRetryUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const refreshData = useCallback(async () => {
    const [statusResult, historyResult] = await Promise.allSettled([getQuotaStatus(), getQuotaHistory()]);
    if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
    else setError(statusResult.reason.message);
    if (historyResult.status === 'fulfilled') {
      const raw = Array.isArray(historyResult.value) ? historyResult.value : pick(historyResult.value, ['history', 'data', 'items']);
      setHistory(Array.isArray(raw) ? raw : []);
    }
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);
  useEffect(() => {
    if (!retryUntil) return undefined;
    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= retryUntil) setRetryUntil(0);
    }, 250);
    return () => window.clearInterval(timer);
  }, [retryUntil]);

  const plan = String(pick(status, ['plan', 'plan_name', 'tier']) || '—').toUpperCase();
  const usedTokens = number(pick(status, ['tokens_used', 'used_tokens', 'tokensUsed', 'monthly_tokens_used']));
  const tokenLimit = number(pick(status, ['token_limit', 'tokens_limit', 'monthly_limit', 'monthlyTokenLimit']));
  const availableTokens = number(pick(status, ['tokens_available', 'remaining_tokens', 'tokensRemaining'])) ?? (usedTokens !== null && tokenLimit !== null ? Math.max(0, tokenLimit - usedTokens) : null);
  const requestsUsed = number(pick(status, ['requests_used', 'requests_this_minute', 'requestsUsed', 'rate_limit_used']));
  const requestLimit = number(pick(status, ['requests_limit', 'rate_limit', 'requests_per_minute', 'requestsLimit']));
  const tokenProgress = tokenLimit > 0 && usedTokens !== null ? Math.min(100, (usedTokens / tokenLimit) * 100) : 0;
  const historyRows = useMemo(() => history.slice(-7).map((item, index) => ({
    label: String(pick(item, ['date', 'day', 'label']) ?? `Day ${index + 1}`),
    tokens: number(pick(item, ['tokens', 'tokens_used', 'usage', 'count'])) ?? 0,
  })), [history]);
  const maxHistory = Math.max(1, ...historyRows.map((item) => item.tokens));
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const estimate = estimateTokens(prompt);

  async function handleSubmit(event) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || loading || retrySeconds > 0) return;
    setPrompt('');
    setError('');
    setLoading(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text: value }]);
    try {
      const result = await generateResponse(value);
      const answer = pick(result, ['response', 'output', 'content', 'text', 'message']);
      const displayAnswer = typeof answer === 'string' ? answer : answer ? JSON.stringify(answer, null, 2) : JSON.stringify(result, null, 2);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: displayAnswer }]);
      await refreshData();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 402) setUpgradeOpen(true);
      else if (requestError instanceof ApiError && requestError.status === 429) {
        const rawRetryAfter = requestError.retryAfter;
        const retryDate = rawRetryAfter && Number.isNaN(Number(rawRetryAfter)) ? Date.parse(rawRetryAfter) : NaN;
        const retryTime = Number.isFinite(retryDate) ? retryDate : Date.now() + Math.max(1, Number(rawRetryAfter) || 60) * 1000;
        setNow(Date.now());
        setRetryUntil(retryTime);
      } else setError(requestError.message);
    } finally { setLoading(false); }
  }

  async function handleUpgrade() {
    setUpgrading(true);
    setError('');
    try {
      await upgradePlan();
      setUpgradeOpen(false);
      await refreshData();
    } catch (requestError) { setError(requestError.message); }
    finally { setUpgrading(false); }
  }

  const nav = <>
    <div className="brand"><div className="brand-mark"><Command size={19} strokeWidth={2.5} /></div><span>proxy<span className="brand-light">.ai</span></span><button className="collapse-button" aria-label="Collapse sidebar"><ChevronDown size={16} /></button></div>
    <div className="workspace-label">WORKSPACE</div>
    <button className="workspace-switch"><span className="workspace-icon"><Sparkles size={15} /></span><span><strong>Acme Studio</strong><small>Personal workspace</small></span><ChevronDown size={15} /></button>
    <div className="nav-section-label">PLATFORM</div>
    <nav className="side-nav"><a className="nav-item active" href="#chat" onClick={() => setMobileNav(false)}><MessageSquare size={18} />Chat <span className="nav-dot" /></a><a className="nav-item" href="#usage" onClick={() => setMobileNav(false)}><BarChart3 size={18} />Usage</a><a className="nav-item" href="#history" onClick={() => setMobileNav(false)}><Activity size={18} />Analytics</a><a className="nav-item" href="#plan" onClick={() => setMobileNav(false)}><CreditCard size={18} />Billing</a></nav>
    <div className="nav-section-label tools-label">PREFERENCES</div><nav className="side-nav"><a className="nav-item" href="#settings"><Settings2 size={18} />Settings</a><a className="nav-item" href="#help"><CircleHelp size={18} />Help center</a></nav>
    <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Zap size={15} fill="currentColor" /></div><strong>Unlock your potential</strong><p>Get more tokens and faster responses.</p><button onClick={() => setUpgradeOpen(true)}>Explore plans <ArrowUpRight size={14} /></button></div><div className="profile"><div className="avatar">JD</div><div className="profile-copy"><strong>Jordan Davis</strong><span>jordan@acme.studio</span></div><MoreHorizontal size={18} /></div></div>
  </>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>{nav}</aside>
    {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>AI Playground</strong></div><div className="topbar-actions"><span className="api-status"><i /> API operational</span><button className="icon-button" aria-label="Refresh data" onClick={refreshData}><RefreshCw size={17} /></button><div className="top-avatar">JD</div></div></header>
      <div className="page-content">
        <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR AI WORKSPACE</div><h1>Good morning, Jordan <span className="wave">✦</span></h1><p>Build something remarkable today. Your AI workspace is ready.</p></div><button className="date-chip"><Clock3 size={15} /> Last 30 days <ChevronDown size={14} /></button></section>
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
        <section className="stats-grid" id="usage">
          <article className="stat-card plan-stat" id="plan"><div className="stat-top"><span className="stat-label">CURRENT PLAN</span><span className={`plan-badge ${['FREE', 'PRO', 'ENTERPRISE'].includes(plan) ? plan.toLowerCase() : ''}`}>{plan === '—' ? 'PLAN' : plan}</span></div><div className="plan-title">{plan === '—' ? 'Plan unavailable' : `${plan.charAt(0)}${plan.slice(1).toLowerCase()} plan`}<span className="plan-spark"><Sparkles size={17} /></span></div><div className="stat-foot"><span>{plan === 'FREE' ? 'A great place to start' : 'Your workspace is active'}</span><button className="text-link" onClick={() => setUpgradeOpen(true)}>Manage plan <ArrowUpRight size={13} /></button></div></article>
          <article className="stat-card token-stat"><div className="stat-top"><span className="stat-label">TOKENS THIS MONTH</span><span className="stat-icon violet"><Database size={16} /></span></div><div className="stat-number">{formatNumber(usedTokens)}<span className="stat-unit"> tokens</span></div><div className="progress-track"><span style={{ width: `${tokenProgress}%` }} /></div><div className="stat-foot"><span>{formatNumber(availableTokens)} available</span><span>of {formatNumber(tokenLimit)}</span></div></article>
          <article className="stat-card request-stat"><div className="stat-top"><span className="stat-label">REQUESTS / MINUTE</span><span className="stat-icon blue"><Gauge size={16} /></span></div><div className="stat-number">{formatNumber(requestsUsed)}<span className="stat-separator"> / </span><span className="number-muted">{formatNumber(requestLimit)}</span></div><div className="request-meter">{Array.from({ length: 12 }, (_, index) => <i key={index} className={requestsUsed !== null && requestsUsed / Math.max(1, requestLimit || 12) * 12 > index ? 'filled' : ''} />)}</div><div className="stat-foot"><span>Requests used</span><span className="soft-green"><ShieldCheck size={13} /> Within limits</span></div></article>
        </section>

        <div className="dashboard-grid"><section className="chat-card" id="chat"><div className="card-heading chat-heading"><div className="heading-icon"><Bot size={18} /></div><div className="heading-copy"><h2>AI Playground</h2><p>Have a conversation with your AI model</p></div><span className="model-pill"><i /> AI assistant</span></div><div className="chat-body">{messages.length === 0 && !loading ? <div className="empty-chat"><div className="empty-orbit orbit-one" /><div className="empty-orbit orbit-two" /><div className="empty-icon"><Sparkles size={24} /></div><h3>What can I help you with?</h3><p>Ask a question, brainstorm an idea, or get help with a task.</p><div className="suggestions"><button onClick={() => setPrompt('Help me brainstorm ideas for a new project')}>✦ &nbsp;Brainstorm ideas</button><button onClick={() => setPrompt('Explain a complex topic in simple terms')}>◈ &nbsp;Explain a topic</button><button onClick={() => setPrompt('Help me write a professional email')}>↗ &nbsp;Write something</button></div></div> : <div className="message-list">{messages.map((message) => <div className={`message-row ${message.role}`} key={message.id}><div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={15} /> : 'JD'}</div><div className="message-content"><span className="message-name">{message.role === 'assistant' ? 'AI Assistant' : 'You'}</span><p>{message.text}</p></div></div>)}{loading && <div className="message-row assistant"><div className="message-avatar"><Sparkles size={15} /></div><div className="message-content"><span className="message-name">AI Assistant</span><p className="typing"><i /><i /><i /><span>Thinking</span></p></div></div>}</div>}</div><form className="composer" onSubmit={handleSubmit}><div className="composer-wrap"><textarea rows="1" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSubmit(event); } }} placeholder="Message AI assistant..." aria-label="Write a prompt" /><div className="composer-footer"><span className="estimate"><Sparkles size={13} /> ~{formatNumber(estimate)} tokens <span className="estimate-caption">estimated</span></span><span className="composer-hint">Press <kbd>↵</kbd> to send</span><button className="send-button" type="submit" disabled={!prompt.trim() || loading || retrySeconds > 0} aria-label="Send prompt">{retrySeconds > 0 ? <>{retrySeconds}s</> : <Send size={16} />}</button></div></div></form>{retrySeconds > 0 && <div className="rate-limit-note"><Clock3 size={14} /> Rate limit reached. Try again in <strong>{retrySeconds}s</strong>.</div>}</section>

          <aside className="right-column"><section className="history-card" id="history"><div className="card-heading"><div><h2>Token usage</h2><p>Your activity over the last 7 days</p></div><button className="more-button" aria-label="More usage options"><MoreHorizontal size={19} /></button></div><div className="chart-summary"><div><span className="chart-total">{formatNumber(historyRows.reduce((sum, item) => sum + item.tokens, 0))}</span><span className="chart-unit"> tokens</span></div><span className="chart-trend"><TrendingUp size={13} /> Last 7 days</span></div><div className="bar-chart" role="img" aria-label="Token consumption for the last seven days">{historyRows.length ? historyRows.map((item, index) => <div className="bar-column" key={`${item.label}-${index}`}><div className="bar-rail"><span className={index === historyRows.length - 1 ? 'bar current' : 'bar'} style={{ height: `${Math.max(4, (item.tokens / maxHistory) * 100)}%` }} title={`${formatNumber(item.tokens)} tokens`} /></div><span className="bar-label">{item.label.slice(0, 3)}</span></div>) : <div className="chart-empty">Usage history will appear here</div>}</div><div className="chart-legend"><span><i /> Tokens consumed</span><button onClick={refreshData}>View report <ArrowUpRight size={13} /></button></div></section>
          <section className="quick-card"><div className="quick-top"><div className="quick-icon"><Zap size={16} /></div><span className="quick-label">QUICK TIP</span></div><h3>Make every token count</h3><p>Clear, specific prompts help you get better results while using fewer tokens.</p><div className="tip-example"><span className="tip-dot" /><span>Try being specific about the format you need</span><ArrowDownLeft size={14} /></div></section>
          <section className="usage-note"><div className="usage-note-icon"><Activity size={15} /></div><span>Usage data refreshes after each request</span><button aria-label="Refresh usage" onClick={refreshData}><RefreshCw size={13} /></button></section></aside></div>
        <footer className="page-footer"><span>© 2025 Proxy AI. Built for makers.</span><div><a href="#docs">Documentation</a><a href="#status">System status <i /></a></div></footer>
      </div>
    </main>
    {upgradeOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setUpgradeOpen(false); }}><section className="upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-title"><button className="modal-close" onClick={() => setUpgradeOpen(false)} aria-label="Close dialog"><X size={18} /></button><div className="modal-art"><div><Zap size={25} fill="currentColor" /></div><span className="spark spark-a">✦</span><span className="spark spark-b">✧</span></div><span className="modal-eyebrow">UNLOCK MORE</span><h2 id="upgrade-title">There’s more room to create.</h2><p>Upgrade to Pro for a higher monthly token quota and keep your ideas flowing.</p><div className="pro-feature"><span><Check size={15} /></span><div><strong>Pro plan</strong><small>More room for your next big idea</small></div><span className="pro-badge">PRO</span></div><button className="upgrade-confirm" disabled={upgrading} onClick={handleUpgrade}>{upgrading ? 'Upgrading…' : 'Upgrade to Pro'} <ArrowUpRight size={16} /></button><span className="modal-footnote">Plan changes are subject to your account’s available options.</span></section></div>}
  </div>;
}

export default App;
