"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import { supabaseClient } from "@/lib/supabase/client";
import LogoUpload from "@/components/admin/LogoUpload";
import { authFetch } from "@/lib/authFetch";

type AppSettings = {
  id?: string;
  brand_name?: string | null;
  brand_logo_url?: string | null;
  default_language?: string | null;
  whatsapp_default_template?: string | null;
  welcome_instructions?: string | null;
  welcome_instructions_ar?: string | null;
  thank_you_title?: string | null;
  thank_you_title_ar?: string | null;
  thank_you_message?: string | null;
  thank_you_message_ar?: string | null;
  enable_name_search?: boolean;
  enable_code_search?: boolean;
  enable_multi_exam?: boolean;
  code_length?: number;
  code_format?: "numeric" | "alphabetic" | "alphanumeric" | "custom";
  code_pattern?: string | null;
};

type Admin = {
  id: string;
  email: string;
  created_at: string;
  username?: string;
  raw_user_meta_data?: any;
};

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Administrator Management
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Load settings and admins on mount
  useEffect(() => {
    loadSettings();
    loadAdmins();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await authFetch("/api/admin/settings");
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result?.error || "Failed to load settings");
      }

      if (result.item) {
        setSettings(result.item);
      } else {
        // Initialize with defaults
        setSettings({
          brand_name: "Exam System",
          default_language: "en",
          enable_name_search: true,
          enable_code_search: false,
          enable_multi_exam: true,
          code_length: 4,
          code_format: "numeric",
          code_pattern: null,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);

      const res = await authFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result?.error || "Failed to save settings");
      }

      // Update local state with saved data
      setSettings(result.item);
      
      // Show success message
      alert("Settings saved successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const loadAdmins = async () => {
    try {
      setLoadingAdmins(true);
      const res = await authFetch("/api/admin/admins");
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load admins:", err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    
    try {
      setAddingAdmin(true);
      const res = await authFetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newAdminEmail.trim() })
      });
      
      if (res.ok) {
        setNewAdminEmail("");
        loadAdmins();
        alert("Administrator added successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to add administrator");
      }
    } catch (err) {
      alert("Failed to add administrator");
    } finally {
      setAddingAdmin(false);
    }
  };

  const removeAdmin = async (adminId: string) => {
    if (!confirm("Are you sure you want to remove this administrator?")) return;
    
    try {
      const res = await authFetch(`/api/admin/admins/${adminId}`, {
        method: "DELETE"
      });
      
      if (res.ok) {
        loadAdmins();
        alert("Administrator removed successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to remove administrator");
      }
    } catch (err) {
      alert("Failed to remove administrator");
    }
  };

  const updateSetting = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const getCodeFormatExample = () => {
    const { code_format, code_pattern, code_length } = settings;
    
    if (code_format === "custom" && code_pattern) {
      return code_pattern.replace(/N/g, "0").replace(/A/g, "A").replace(/#/g, "0");
    }
    
    switch (code_format) {
      case "numeric":
        return "0".repeat(code_length || 4);
      case "alphabetic":
        return "A".repeat(code_length || 4);
      case "alphanumeric":
        return "A0".repeat(Math.ceil((code_length || 4) / 2)).substring(0, code_length || 4);
      default:
        return "0000";
    }
  };

  if (loading) {
    return (
      <AdminGuard>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-600">Loading settings...</p>
          </div>
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                  System Settings
                </h1>
                <p className="text-slate-600 text-lg">Configure your exam application settings and preferences</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Settings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* System Configuration */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-800">System Configuration</h2>
              </div>

              <div className="space-y-6">
                {/* Multi-Exam Mode */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Exam Mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => updateSetting("enable_multi_exam", false)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        !settings.enable_multi_exam
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-semibold">Single Exam</div>
                        <div className="text-sm opacity-75">One exam per student code</div>
                      </div>
                    </button>
                    <button
                      onClick={() => updateSetting("enable_multi_exam", true)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        settings.enable_multi_exam
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-semibold">Multi-Exam</div>
                        <div className="text-sm opacity-75">Multiple exams per student</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Student Results Search Mode */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Student Results Search Mode</label>
                  <p className="text-sm text-slate-600 mb-4">Configure how students can search for their results on the public results page.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        updateSetting("enable_name_search", true);
                        updateSetting("enable_code_search", false);
                      }}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        settings.enable_name_search && !settings.enable_code_search
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-semibold">Name Search</div>
                        <div className="text-sm opacity-75">Students search by their name</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        updateSetting("enable_name_search", false);
                        updateSetting("enable_code_search", true);
                      }}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                        !settings.enable_name_search && settings.enable_code_search
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-semibold">Code Search</div>
                        <div className="text-sm opacity-75">Students search by their code</div>
                      </div>
                    </button>
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-blue-800">
                        <strong>Note:</strong> This setting controls how students can find their exam results on the public results page. 
                        {settings.enable_name_search && !settings.enable_code_search && " Students will search by entering their name."}
                        {!settings.enable_name_search && settings.enable_code_search && " Students will search by entering their unique code."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Code Format */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Student Code Format</h2>
              </div>

              <div className="space-y-6">
                {/* Code Length */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Code Length</label>
                  <select
                    value={settings.code_length || 4}
                    onChange={(e) => updateSetting("code_length", parseInt(e.target.value))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(length => (
                      <option key={length} value={length}>{length} characters</option>
                    ))}
                  </select>
                </div>

                {/* Code Format */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Format Type</label>
                  <select
                    value={settings.code_format || "numeric"}
                    onChange={(e) => updateSetting("code_format", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="numeric">Numeric (0-9)</option>
                    <option value="alphabetic">Alphabetic (A-Z)</option>
                    <option value="alphanumeric">Alphanumeric (A-Z, 0-9)</option>
                    <option value="custom">Custom Pattern</option>
                  </select>
                </div>

                {/* Custom Pattern */}
                {settings.code_format === "custom" && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Custom Pattern</label>
                    <input
                      type="text"
                      value={settings.code_pattern || ""}
                      onChange={(e) => updateSetting("code_pattern", e.target.value)}
                      placeholder="e.g., EX-NNN or AA##"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="mt-2 text-sm text-slate-600">
                      <p className="font-medium mb-1">Pattern Guide:</p>
                      <ul className="space-y-1 text-xs">
                        <li>• <code className="bg-slate-100 px-1 rounded">N</code> = Number (0-9)</li>
                        <li>• <code className="bg-slate-100 px-1 rounded">A</code> = Letter (A-Z)</li>
                        <li>• <code className="bg-slate-100 px-1 rounded">#</code> = Alphanumeric (A-Z, 0-9)</li>
                        <li>• Any other character = Literal</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Preview */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="text-sm font-semibold text-slate-700 mb-2">Preview Example:</div>
                  <div className="text-2xl font-mono font-bold text-blue-600 tracking-wider">
                    {getCodeFormatExample()}
                  </div>
                </div>
              </div>
            </div>

            {/* Branding */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Branding</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Brand Name</label>
                  <input
                    type="text"
                    value={settings.brand_name || ""}
                    onChange={(e) => updateSetting("brand_name", e.target.value)}
                    placeholder="Your Organization Name"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <LogoUpload
                    currentLogoUrl={settings.brand_logo_url}
                    onLogoChange={(url) => updateSetting("brand_logo_url", url)}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Default Language</label>
                  <select
                    value={settings.default_language || "en"}
                    onChange={(e) => updateSetting("default_language", e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Messages & Templates */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Messages & Templates</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">WhatsApp Default Template</label>
                  <textarea
                    value={settings.whatsapp_default_template || ""}
                    onChange={(e) => updateSetting("whatsapp_default_template", e.target.value)}
                    placeholder="Default WhatsApp message template..."
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Welcome Instructions (English)</label>
                  <textarea
                    value={settings.welcome_instructions || ""}
                    onChange={(e) => updateSetting("welcome_instructions", e.target.value)}
                    placeholder="Instructions shown to students before starting the exam..."
                    rows={4}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Welcome Instructions (Arabic)</label>
                  <textarea
                    value={settings.welcome_instructions_ar || ""}
                    onChange={(e) => updateSetting("welcome_instructions_ar", e.target.value)}
                    placeholder="تعليمات للطلاب قبل بدء الامتحان..."
                    rows={4}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    dir="rtl"
                  />
                </div>

                {/* Thank You Messages */}
                <div className="pt-6 border-t border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Thank You Page Messages</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-3">Thank You Title (English)</label>
                      <input
                        type="text"
                        value={settings.thank_you_title || ""}
                        onChange={(e) => updateSetting("thank_you_title", e.target.value)}
                        placeholder="Thank you for completing the exam!"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-3">Thank You Title (Arabic)</label>
                      <input
                        type="text"
                        value={settings.thank_you_title_ar || ""}
                        onChange={(e) => updateSetting("thank_you_title_ar", e.target.value)}
                        placeholder="شكراً لك لإكمال الامتحان!"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        dir="rtl"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-3">Thank You Message (English)</label>
                      <textarea
                        value={settings.thank_you_message || ""}
                        onChange={(e) => updateSetting("thank_you_message", e.target.value)}
                        placeholder="Your responses have been submitted successfully..."
                        rows={3}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-3">Thank You Message (Arabic)</label>
                      <textarea
                        value={settings.thank_you_message_ar || ""}
                        onChange={(e) => updateSetting("thank_you_message_ar", e.target.value)}
                        placeholder="تم إرسال إجاباتك بنجاح..."
                        rows={3}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        dir="rtl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Administrator Management */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
              <div className="mb-10">
                <h2 className="text-2xl font-semibold text-gray-900 mb-3 flex items-center gap-3">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Administrator Management
                </h2>
                <p className="text-gray-500 text-md ml-9">Manage users who have administrative access to the system</p>
              </div>

              {/* Account Management Interface */}
              <div className="bg-white rounded-xl p-8 mb-10 shadow-sm border border-gray-100">
                <h3 className="text-lg font-medium text-gray-800 mb-6 flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Create New Admin Account
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Username (optional)"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Email address"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Password (min 8 characters)"
                      disabled
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={addAdmin}
                    disabled={addingAdmin || !newAdminEmail.trim()}
                    className="px-8 py-3 rounded-xl text-md font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white disabled:cursor-not-allowed"
                  >
                    {addingAdmin ? "Creating..." : "Create Admin Account"}
                  </button>
                </div>
              </div>

              {/* Admins Table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {loadingAdmins ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 mx-auto border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Username</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Email</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Added</th>
                          <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {admins.map((admin) => (
                          <tr key={admin.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">
                                {admin.username || admin.raw_user_meta_data?.username || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{admin.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-500">
                                {new Date(admin.created_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => removeAdmin(admin.id)}
                                className="text-red-600 hover:text-red-800 p-2 rounded transition-colors"
                                title="Remove administrator"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                        {admins.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                              No administrators found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
