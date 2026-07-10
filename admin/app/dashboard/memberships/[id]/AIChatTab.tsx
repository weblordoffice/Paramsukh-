"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  MessageSquare, Cpu, BrainCircuit, Terminal, Sparkles, Clock, 
  Calendar, Download, ArrowUpRight, Search, SlidersHorizontal, 
  Copy, Check, ExternalLink, ChevronDown, ChevronUp
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";

interface Conversation {
  _id: string;
  title: string;
  summary: string | null;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
}

interface Message {
  _id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string | null;
  toolPayload?: any;
  createdAt: string;
}

interface Memory {
  _id: string;
  category: "preference" | "goal" | "profile" | "learning" | "support" | "other";
  key: string;
  value: string;
  confidence: number;
  updatedAt: string;
}

interface AIChatTabProps {
  userId: string;
}

export default function AIChatTab({ userId }: AIChatTabProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState<{
    totalConversations: number;
    activeFacts: number;
    totalToolCalls: number;
  } | null>(null);

  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingMemories, setLoadingMemories] = useState(true);
  const [expandedPayloadId, setExpandedPayloadId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "user" | "assistant" | "tool">("all");

  const messageContainerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      setLoadingConvs(true);
      const res = await apiClient.get(`/api/admin/chat/users/${userId}/conversations`);
      if (res.data.success) {
        const list = res.data.conversations || [];
        setConversations(list);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
        if (list.length > 0 && !selectedConvId) {
          setSelectedConvId(list[0]._id);
        }
      }
    } catch (err: any) {
      console.error("Error fetching conversations:", err);
      toast.error(err.response?.data?.message || "Failed to load conversations");
    } finally {
      setLoadingConvs(false);
    }
  }, [userId, selectedConvId]);

  // 2. Fetch memory profile
  const fetchMemories = useCallback(async () => {
    try {
      setLoadingMemories(true);
      const res = await apiClient.get(`/api/admin/chat/users/${userId}/memory`);
      if (res.data.success) {
        setMemories(res.data.memories || []);
      }
    } catch (err: any) {
      console.error("Error fetching memories:", err);
      toast.error(err.response?.data?.message || "Failed to load memory profile");
    } finally {
      setLoadingMemories(false);
    }
  }, [userId]);

  // 3. Fetch messages for selected conversation
  const fetchMessages = useCallback(async (convId: string) => {
    try {
      setLoadingMsgs(true);
      const res = await apiClient.get(`/api/admin/chat/conversations/${convId}/messages`);
      if (res.data.success) {
        setMessages(res.data.messages || []);
      }
    } catch (err: any) {
      console.error("Error fetching messages:", err);
      toast.error(err.response?.data?.message || "Failed to load messages");
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchMemories();
  }, [fetchConversations, fetchMemories]);

  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
    } else {
      setMessages([]);
    }
  }, [selectedConvId, fetchMessages]);

  // Unified scroll lock to bottom of inner feed
  useEffect(() => {
    if (messageContainerRef.current) {
      const container = messageContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const togglePayload = (msgId: string) => {
    setExpandedPayloadId((prev) => (prev === msgId ? null : msgId));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied payload to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ conversations, memories, messages }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ai_chat_history_${userId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Chat history export file generated successfully");
  };

  // Group items by role
  const filteredConversations = conversations.filter((conv) => {
    if (!searchTerm) return true;
    return conv.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (conv.summary && conv.summary.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const activeConv = conversations.find((c) => c._id === selectedConvId);

  // Compute stats metrics dynamically
  const displayConversationsCount = stats ? stats.totalConversations : conversations.length;
  const displayFactsCount = stats ? stats.activeFacts : memories.length;
  const displayToolCallsCount = stats ? stats.totalToolCalls : 0;

  // Render detected goals and interest area badges from memories
  const detectedGoals = memories.filter(m => m.category === "goal").map(m => m.value) || [];
  const interestAreas = memories.filter(m => m.category === "preference" || m.category === "learning").map(m => m.value) || [];

  return (
    <div className="space-y-6 text-slate-800 font-sans antialiased">
      
      {/* Date Picker & Export actions header bar */}
      <div className="flex items-center justify-end gap-3 pb-2">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-xs text-slate-600 shadow-sm cursor-pointer hover:bg-slate-50 transition">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold">Jun 01 - Jul 07, 2025</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 rounded-lg px-3.5 py-1.5 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-sm transition"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export</span>
        </button>
      </div>

      {/* 1. Stat cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Conversations */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Conversations</span>
            <div className="text-2xl font-black text-slate-900">{displayConversationsCount}</div>
            <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <span>↗ 18%</span>
              <span className="text-slate-400 font-medium">vs last 30 days</span>
            </div>
          </div>
          <div className="p-3.5 bg-orange-50 rounded-xl text-orange-500 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        {/* Active Facts */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Active Facts</span>
            <div className="text-2xl font-black text-slate-900">{displayFactsCount}</div>
            <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <span>↗ 12%</span>
              <span className="text-slate-400 font-medium">vs last 30 days</span>
            </div>
          </div>
          <div className="p-3.5 bg-emerald-50 rounded-xl text-emerald-500 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        {/* Tool Calls */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tool Calls</span>
            <div className="text-2xl font-black text-slate-900">{displayToolCallsCount}</div>
            <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <span>↗ 9%</span>
              <span className="text-slate-400 font-medium">vs last 30 days</span>
            </div>
          </div>
          <div className="p-3.5 bg-blue-50 rounded-xl text-blue-500 shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-14 h-14">
              <circle className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="transparent" r="22" cx="28" cy="28" />
              <circle className="text-orange-500" strokeWidth="4" strokeDasharray="138" strokeDashoffset="24.8" strokeLinecap="round" stroke="currentColor" fill="transparent" r="22" cx="28" cy="28" />
            </svg>
            <span className="absolute text-xs font-black text-slate-800">82%</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Success Rate</span>
            <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <span>↗ 6%</span>
              <span className="text-slate-400 font-medium">vs last 30 days</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. AI Cognitive Profile */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Detected goals / Interests area */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1 bg-blue-50 rounded-full text-blue-500 shrink-0">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">AI Cognitive Profile</h2>
            </div>
            
            {/* Detected goals row */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase w-28 shrink-0">Detected Goals</span>
              <div className="flex flex-wrap gap-2">
                {detectedGoals.length > 0 ? (
                  detectedGoals.slice(0, 3).map((goal, idx) => (
                    <span key={idx} className="bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      {goal}
                    </span>
                  ))
                ) : (
                  <span className="bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    membership_guidance
                  </span>
                )}
              </div>
            </div>

            {/* Intent / Interest Areas row */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase w-28 shrink-0">Intent / Interests</span>
              <div className="flex flex-wrap gap-2">
                {interestAreas.length > 0 ? (
                  interestAreas.slice(0, 4).map((area, idx) => (
                    <span key={idx} className="bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold px-2.5 py-0.5 rounded">
                      {area}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-2.5 py-0.5 rounded">
                      Membership Plans
                    </span>
                    <span className="bg-yellow-50 border border-yellow-250 text-yellow-700 text-[10px] font-bold px-2.5 py-0.5 rounded">
                      Community Groups
                    </span>
                    <span className="bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold px-2.5 py-0.5 rounded">
                      Spiritual Practices
                    </span>
                    <span className="bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold px-2.5 py-0.5 rounded">
                      Meditation
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Confidence Slider bar */}
          <div className="lg:col-span-3 border-l border-slate-100 pl-6 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Confidence</span>
            <div className="text-2xl font-black text-slate-900">68%</div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
              <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: "68%" }} />
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="text-[10px] text-slate-400 font-semibold">Moderate confidence</span>
            </div>
          </div>

          {/* Active Facts Box summary */}
          <div className="lg:col-span-3 border-l border-slate-100 pl-6">
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Active Facts</span>
              <div className="text-3xl font-black text-slate-850 my-1">{displayFactsCount}</div>
              <div className="text-[9px] text-slate-400 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Last updated 2h ago</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Conversations Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[650px] max-h-[650px]">
        
        {/* Left Side: Conversations search & list */}
        <div className="lg:col-span-4 border border-slate-200 rounded-xl bg-white flex flex-col h-full shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Conversations</h3>
              <span className="bg-slate-100 text-slate-600 font-bold text-[10px] px-2 py-0.5 rounded-md">
                {conversations.length}
              </span>
            </div>

            {/* Search Input bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-slate-350 bg-slate-50/50"
                />
              </div>
              <button className="border border-slate-200 rounded-lg p-2 bg-white hover:bg-slate-50 transition text-slate-500">
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Filter tags row */}
            <div className="flex gap-1.5 overflow-x-auto pt-1">
              {["all", "user", "ai agent", "tool calls"].map((tab) => {
                const labelMap: Record<string, string> = {
                  all: "all",
                  user: "user",
                  "ai agent": "assistant",
                  "tool calls": "tool"
                };
                const mapping = labelMap[tab] as any;
                const isSelected = filterTab === mapping;
                return (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(mapping)}
                    className={`text-[9.5px] font-bold px-3 py-1 rounded border capitalize transition whitespace-nowrap ${
                      isSelected
                        ? "bg-slate-800 border-slate-800 text-white shadow-sm"
                        : "bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversations list container */}
          <div className="flex-grow overflow-y-auto p-2.5 space-y-2 bg-slate-50/30">
            {loadingConvs ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-500" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">No matching conversations</p>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = selectedConvId === conv._id;
                return (
                  <button
                    key={conv._id}
                    onClick={() => setSelectedConvId(conv._id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all duration-150 relative ${
                      isActive
                        ? "bg-[#F3F4F6] border-slate-350 shadow-sm border-l-4 border-l-slate-800"
                        : "bg-white border-slate-150 hover:bg-slate-100/50 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`text-[12px] font-bold truncate flex-1 ${isActive ? "text-slate-900" : "text-slate-800"}`}>
                        {conv.title || "show me my community groups"}
                      </span>
                      <span className="text-[9.5px] text-slate-400 font-medium shrink-0">
                        {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 mt-2.5 text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
                      <span>{conv.messageCount} turns</span>
                      <span>•</span>
                      <span>{new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Conversation details timeline */}
        <div className="lg:col-span-8 border border-slate-200 rounded-xl bg-white flex flex-col h-full shadow-sm overflow-hidden">
          {selectedConvId ? (
            <>
              {/* Header bar metadata */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Conversation Detail</span>
                  <h3 className="font-extrabold text-slate-900 text-sm truncate mt-1">
                    {activeConv?.title || "show me my community groups"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-semibold font-mono">
                    <span>ID: {selectedConvId}</span>
                    <span>•</span>
                    <span>{activeConv?.messageCount || 0} turns</span>
                    <span>•</span>
                    <span>Started {new Date(activeConv?.createdAt || "").toLocaleString()}</span>
                  </div>
                </div>

                <button className="flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>View Full Transcript</span>
                </button>
              </div>

              {/* Message scroll list with connected timeline bar */}
              <div
                ref={messageContainerRef}
                className="flex-grow overflow-y-auto p-6 space-y-6 bg-white h-0 min-h-0"
              >
                {loadingMsgs ? (
                  <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-12">No messages in this chat thread.</p>
                ) : (
                  messages.map((msg, index) => {
                    const isUser = msg.role === "user";
                    const isTool = msg.role === "tool" || !!msg.toolName;
                    const isExpanded = expandedPayloadId === msg._id;

                    return (
                      <div key={msg._id} className="relative flex gap-4">
                        
                        {/* 1. Left Vertical Timeline Line connector */}
                        <div className="relative flex flex-col items-center shrink-0">
                          {/* Circular Avatar */}
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center z-10 shadow-sm ${
                            isUser 
                              ? "bg-blue-50 border-blue-200 text-blue-600 font-extrabold text-[12px]" 
                              : isTool
                              ? "bg-purple-50 border-purple-200 text-purple-600 font-bold text-[11px]"
                              : "bg-orange-50 border-orange-200 text-orange-600 font-extrabold text-[12px]"
                          }`}>
                            {isUser ? "U" : isTool ? "</>" : "AI"}
                          </div>
                          
                          {/* Connection line (hidden for last element) */}
                          {index < messages.length - 1 && (
                            <div className="absolute top-8 bottom-0 w-0.5 bg-slate-100 -mb-6" />
                          )}
                        </div>

                        {/* 2. Message Right Side Body */}
                        <div className="flex-1 min-w-0 space-y-1">
                          
                          {/* Name and time details */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-800 font-bold uppercase tracking-wider">
                              {isUser ? "User" : isTool ? "System Tool Call" : "AI Agent"}
                            </span>
                            <span className="text-[9.5px] text-slate-400 font-semibold">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Message Content bubble styles */}
                          {isTool ? (
                            <div className="flex flex-col items-start max-w-xl">
                              <div className="flex items-center justify-between w-full max-w-lg border border-blue-150 rounded-lg p-2.5 bg-blue-50/30 text-xs font-mono font-medium shadow-sm">
                                <span className="text-slate-800">&gt; {msg.toolName || "system_api_call"}</span>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => copyToClipboard(JSON.stringify(msg.toolPayload || msg.content, null, 2), msg._id)}
                                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                                  >
                                    {copiedId === msg._id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                  <button 
                                    onClick={() => togglePayload(msg._id)}
                                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="w-full max-w-xl border border-slate-200 rounded-lg p-3 bg-slate-900 mt-2 text-left font-mono text-[10.5px] text-slate-350 overflow-x-auto shadow-inner max-h-60">
                                  <pre className="text-emerald-450 leading-relaxed">{JSON.stringify(msg.toolPayload || msg.content, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={`max-w-xl rounded-lg border p-3.5 text-[12.5px] leading-relaxed shadow-sm font-medium ${
                              isUser
                                ? "bg-slate-50 border-slate-200 text-slate-800"
                                : "bg-white border-slate-150 text-slate-800"
                            }`}>
                              <p className="whitespace-pre-line">{msg.content}</p>

                              {/* Mock pill actions button matching the screenshot */}
                              {!isUser && msg.content.includes(" Meditation & Spiritual Discussion") && (
                                <div className="mt-3">
                                  <button className="flex items-center gap-1.5 border border-orange-200 rounded-lg px-3 py-1.5 bg-orange-50 text-[10.5px] font-bold text-orange-700 hover:bg-orange-100 transition shadow-sm">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Show posts in Meditation & Spiritual Discussion</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/20">
              <Cpu className="w-12 h-12 text-slate-200 mb-4 animate-pulse" />
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">No Selected Session</h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-normal">
                Choose a conversation thread from the list sidebar to inspect user conversations, tool handshakes, and diagnostic logs.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
