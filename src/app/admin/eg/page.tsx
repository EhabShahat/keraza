"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";

interface BlockedEntry {
  id: string;
  type: "name" | "ip" | "mobile";
  value: string;
  reason?: string;
  created_at: string;
  created_by: string;
}

export default function AdminEasterEggPage() {
  const [newType, setNewType] = useState<"name" | "ip" | "mobile">("name");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");
  const [showForm, setShowForm] = useState(false);

  const toast = useToast();
  const queryClient = useQueryClient();

  // Query blocked entries
  const { data: blockedEntries = [], isLoading, error } = useQuery({
    queryKey: ["blocked-entries"],
    queryFn: async () => {
      const response = await authFetch("/api/admin/blocked-entries");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch blocked entries");
      }
      return response.json();
    },
  });

  // Add blocked entry mutation
  const addMutation = useMutation({
    mutationFn: async (data: { type: "name" | "ip" | "mobile"; value: string; reason?: string }) => {
      const response = await authFetch("/api/admin/blocked-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add blocked entry");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-entries"] });
      setNewValue("");
      setNewReason("");
      setShowForm(false);
      toast.success({ title: "Success", message: "🥚 Entry blocked successfully!" });
    },
    onError: (error: Error) => {
      toast.error({ title: "Error", message: error.message });
    },
  });

  // Remove blocked entry mutation
  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await authFetch(`/api/admin/blocked-entries/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove blocked entry");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-entries"] });
      toast.success({ title: "Success", message: "🥚 Entry unblocked successfully!" });
    },
    onError: (error: Error) => {
      toast.error({ title: "Error", message: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    
    addMutation.mutate({
      type: newType,
      value: newValue.trim(),
      reason: newReason.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Easter Egg Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl p-8 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative text-center">
          <div className="text-6xl mb-4">🥚</div>
          <h1 className="text-3xl font-bold mb-2">
            Easter Egg Admin Panel
          </h1>
          <p className="text-white/80 text-lg">
            Secret admin tools for blocking attempts by name, IP, or mobile number
          </p>
          <div className="mt-4 text-sm text-white/60">
            🤫 This is a special admin feature with enhanced powers!
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-4 left-4 text-2xl opacity-30">🐣</div>
        <div className="absolute top-8 right-8 text-2xl opacity-30">🌟</div>
        <div className="absolute bottom-4 left-8 text-2xl opacity-30">✨</div>
        <div className="absolute bottom-8 right-4 text-2xl opacity-30">🎯</div>
      </div>

      {/* Add New Block Form */}
      <div className="bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-4 border-b border-purple-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🚫</div>
              <h2 className="text-xl font-semibold text-gray-900">Block New Entry</h2>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 transition-all transform hover:scale-105 shadow-md"
            >
              {showForm ? "❌ Cancel" : "➕ Add Block"}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🎯 Block Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as "name" | "ip" | "mobile")}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    <option value="name">👤 Student Name</option>
                    <option value="ip">🌐 IP Address</option>
                    <option value="mobile">📱 Mobile Number</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {newType === "name" ? "👤 Student Name" : newType === "ip" ? "🌐 IP Address" : "📱 Mobile Number"}
                  </label>
                  <input
                    type={newType === "mobile" ? "tel" : "text"}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder={
                      newType === "name" 
                        ? "Enter student name..." 
                        : newType === "ip" 
                        ? "Enter IP address..." 
                        : "Enter mobile number..."
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Reason (Optional)
                </label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Why is this being blocked?"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 disabled:opacity-50 transition-all transform hover:scale-105 shadow-md font-medium"
                >
                  {addMutation.isPending ? "🔄 Adding..." : "🚫 Block Entry"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Blocked Entries List */}
      <div className="bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-4 border-b border-purple-100">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📋</div>
            <h2 className="text-xl font-semibold text-gray-900">
              Blocked Entries ({blockedEntries.length})
            </h2>
          </div>
        </div>
        
        <div className="p-6">
          {error ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🥚❌</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Database Setup Required</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                The blocked entries table hasn't been created yet. Let's fix this!
              </p>
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 text-left max-w-2xl mx-auto border border-purple-200">
                <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-lg">🛠️</span>
                  <strong>Setup Instructions:</strong>
                </p>
                <ol className="text-sm text-gray-700 list-decimal list-inside space-y-2">
                  <li>Go to your Supabase dashboard 🚀</li>
                  <li>Navigate to the SQL Editor 📝</li>
                  <li>Copy and paste the contents of <code className="bg-purple-100 px-2 py-1 rounded">scripts/setup-easter-egg.sql</code></li>
                  <li>Run the script ⚡</li>
                  <li>Refresh this page 🔄</li>
                </ol>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800 flex items-center gap-2">
                    <span>💡</span>
                    <strong>Tip:</strong> The script will create the table with mobile number support!
                  </p>
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
                <div className="absolute inset-0 flex items-center justify-center text-lg">🥚</div>
              </div>
              <p className="mt-4 text-gray-600">Loading blocked entries...</p>
            </div>
          ) : blockedEntries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">🎯✨</div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">All Clear!</h3>
              <p>No entries are currently blocked</p>
              <p className="text-sm text-gray-500 mt-2">🥚 Ready to catch some rule breakers!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blockedEntries.map((entry: BlockedEntry) => (
                <div key={entry.id} className="border-2 border-gray-100 rounded-xl p-5 hover:border-purple-200 hover:bg-purple-50/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full border-2 ${
                          entry.type === "name" 
                            ? "bg-blue-50 text-blue-700 border-blue-200" 
                            : entry.type === "ip"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-green-50 text-green-700 border-green-200"
                        }`}>
                          {entry.type === "name" ? "👤 Name" : entry.type === "ip" ? "🌐 IP" : "📱 Mobile"}
                        </span>
                        <span className="font-bold text-gray-900 text-lg">
                          {entry.value}
                        </span>
                      </div>
                      {entry.reason && (
                        <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-base">📝</span>
                            <span><strong>Reason:</strong> {entry.reason}</span>
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <span>🕒</span>
                        Blocked on {new Date(entry.created_at).toLocaleString()} by {entry.created_by}
                      </p>
                    </div>
                    <button
                      onClick={() => removeMutation.mutate(entry.id)}
                      disabled={removeMutation.isPending}
                      className="ml-6 px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-lg hover:from-gray-200 hover:to-gray-300 disabled:opacity-50 transition-all transform hover:scale-105 shadow-sm font-medium"
                    >
                      {removeMutation.isPending ? "🔄" : "🔓 Unblock"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Box with Easter Egg Theme */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">🥚💡</div>
          <div>
            <h3 className="text-lg font-bold text-blue-800 mb-3">
              🎯 How Easter Egg Blocking Works
            </h3>
            <div className="text-sm text-blue-700 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-base">👤</span>
                <div>
                  <strong>Name blocking:</strong> Prevents students with matching names from accessing exams
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base">🌐</span>
                <div>
                  <strong>IP blocking:</strong> Blocks access from specific IP addresses or ranges
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base">📱</span>
                <div>
                  <strong>Mobile blocking:</strong> Blocks students by their registered mobile numbers (works with student codes)
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base">⚡</span>
                <div>
                  Blocks take effect immediately and are logged in the audit trail
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800 flex items-center gap-2">
                <span>🤫</span>
                <strong>Secret Feature:</strong> This easter egg panel has the same power as the main admin tools!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6">
        <div className="text-4xl mb-2">🥚✨</div>
        <p className="text-gray-500 text-sm">
          🤫 This is a secret admin panel with enhanced blocking powers!
        </p>
        <p className="text-gray-400 text-xs mt-1">
          Keep the easter egg magic alive! 🎉
        </p>
      </div>
    </div>
  );
}