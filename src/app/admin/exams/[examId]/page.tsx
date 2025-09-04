"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import Link from "next/link";

interface Exam {
  id: string;
  title: string;
  description: string | null;
  status: string;
  access_type: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  created_at: string;
}

export default function ExamOverviewPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = React.use(params);

  const { data: exam, isLoading, error } = useQuery({
    queryKey: ["admin", "exam", examId],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return j.exam as Exam;
    },
  });

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4" style={{ color: "var(--destructive)" }}>{(error as any).message}</div>;
  if (!exam) return <div className="p-4">Exam not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{exam.title}</h1>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            exam.status === 'published' ? 'bg-green-100 text-green-800' :
            exam.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {exam.status}
          </span>
          <Link href={`/admin/exams/${examId}/edit`} className="btn btn-primary">
            Edit Exam
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Exam Details Card */}
        <div className="card">
          <h3 className="font-semibold mb-3">Exam Details</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Access Type:</span>
              <span className="ml-2 capitalize">{exam.access_type.replace('_', ' ')}</span>
            </div>
            {exam.duration_minutes && (
              <div>
                <span className="font-medium">Duration:</span>
                <span className="ml-2">{exam.duration_minutes} minutes</span>
              </div>
            )}
            {exam.start_time && (
              <div>
                <span className="font-medium">Start Time:</span>
                <span className="ml-2">{new Date(exam.start_time).toLocaleString()}</span>
              </div>
            )}
            {exam.end_time && (
              <div>
                <span className="font-medium">End Time:</span>
                <span className="ml-2">{new Date(exam.end_time).toLocaleString()}</span>
              </div>
            )}
            <div>
              <span className="font-medium">Created:</span>
              <span className="ml-2">{new Date(exam.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="card">
          <h3 className="font-semibold mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Link href={`/admin/exams/${examId}/questions`} className="btn btn-outline w-full">
              Manage Questions
            </Link>
            <Link href={`/admin/students`} className="btn btn-outline w-full">
              Manage Students
            </Link>
            <Link href={`/admin/results?examId=${examId}`} className="btn btn-outline w-full">
              View Results
            </Link>
          </div>
        </div>

        {/* Exam Access Card */}
        <div className="card">
          <h3 className="font-semibold mb-3">Exam Access</h3>
          <div className="space-y-2 text-sm">
            {exam.status === 'published' && (
              <>
                <div>
                  <span className="font-medium">Exam URL:</span>
                  <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono break-all">
                    {window.location.origin}/exam/{examId}
                  </div>
                </div>
                {exam.access_type === 'code_based' && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600">
                      Students need a valid code to access this exam. 
                      Manage student codes in the <Link href="/admin/students" className="text-blue-600 hover:underline">Students</Link> section.
                    </p>
                  </div>
                )}
              </>
            )}
            {exam.status !== 'published' && (
              <p className="text-sm text-gray-600">
                Publish this exam to make it accessible to students.
              </p>
            )}
          </div>
        </div>
      </div>

      {exam.description && (
        <div className="card">
          <h3 className="font-semibold mb-3">Description</h3>
          <p className="text-gray-700">{exam.description}</p>
        </div>
      )}
    </div>
  );
}