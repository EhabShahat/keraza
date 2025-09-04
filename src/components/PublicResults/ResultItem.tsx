import { memo, useMemo } from "react";

export interface ResultItemData {
  id: string;
  exam_title: string;
  submitted_at: string | null;
  score_percentage: number | null;
  is_pass?: boolean | null;
  pass_threshold?: number | null;
}

interface ResultItemProps {
  result: ResultItemData;
}

function ResultItem({ result }: ResultItemProps) {
  const submittedAtText = useMemo(() => (
    result.submitted_at ? new Date(result.submitted_at).toLocaleString() : "—"
  ), [result.submitted_at]);

  const scoreBadge = useMemo(() => {
    if (typeof result.score_percentage !== 'number') return null;
    const cls = result.score_percentage >= 80
      ? 'bg-green-50 text-green-700'
      : result.score_percentage >= 60
        ? 'bg-yellow-50 text-yellow-700'
        : 'bg-red-50 text-red-700';
    return (
      <div className={`font-bold text-lg px-3 py-1 rounded-lg ${cls}`}>
        {result.score_percentage}%
      </div>
    );
  }, [result.score_percentage]);

  const passBadge = useMemo(() => {
    if (result.is_pass === true) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
          PASS
        </span>
      );
    }
    if (result.is_pass === false) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          FAIL
        </span>
      );
    }
    if (typeof result.score_percentage === 'number' && typeof result.pass_threshold === 'number') {
      return result.score_percentage >= result.pass_threshold ? (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">PASS</span>
      ) : (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">FAIL</span>
      );
    }
    return null;
  }, [result.is_pass, result.score_percentage, result.pass_threshold]);

  return (
    <li className="py-4" key={result.id}>
      <div className="flex items-start justify-between">
        <div className="pr-4">
          <div className="font-semibold text-gray-900">{result.exam_title}</div>
          <div className="text-sm text-gray-500">{submittedAtText}</div>
        </div>
        <div className="flex items-center gap-3">
          {scoreBadge ?? <span className="text-gray-400">-</span>}
          {passBadge}
        </div>
      </div>
    </li>
  );
}

export default memo(ResultItem);
export type { ResultItemProps };
