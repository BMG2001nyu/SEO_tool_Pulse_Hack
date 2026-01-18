import { ChevronDown, Play, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAudit } from "@/context/AuditContext";
import { getBenchmarkQuestions, startBenchmark, getBenchmarkStatus, BenchmarkQueryResult } from "@/lib/api";

interface AccordionSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: React.ReactNode;
}

function AccordionSection({ title, defaultOpen = true, children, badge }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm">{title}</span>
          {badge}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreBar({ label, value, color = "primary" }: { label: string; value: number; color?: string }) {
  const colorClass = color === "success" ? "bg-green-500" : color === "warning" ? "bg-yellow-500" : "bg-primary";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${colorClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

function QuestionItem({ result }: { result: BenchmarkQueryResult }) {
  const isAnswered = result.status === "answered";

  return (
    <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
      <div className="flex items-start gap-2">
        {isAnswered ? (
          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground font-medium">{result.query}</p>
          {isAnswered && result.answer && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{result.answer}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded ${isAnswered ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isAnswered ? 'Answered' : 'Not Found'}
            </span>
            {result.metrics && (
              <span className="text-xs text-muted-foreground">
                Completeness: {Math.round(result.metrics.completeness * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuditControlsPanel() {
  const { sessionId, auditStatus, benchmarkData, setBenchmarkData } = useAudit();
  const [questions, setQuestions] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuditCompleted = auditStatus?.status === "completed";
  const isBenchmarkRunning = benchmarkData?.status === "running" || isRunning;
  const isBenchmarkCompleted = benchmarkData?.status === "completed";

  // Fetch default questions on mount
  useEffect(() => {
    getBenchmarkQuestions()
      .then((data) => setQuestions(data.questions))
      .catch(console.error);
  }, []);

  // Poll for benchmark status
  useEffect(() => {
    if (!sessionId || benchmarkData?.status !== "running") return;

    const interval = setInterval(async () => {
      try {
        const status = await getBenchmarkStatus(sessionId);
        setBenchmarkData(status);
        if (status.status === "completed" || status.status === "failed") {
          setIsRunning(false);
        }
      } catch (err) {
        console.error("Failed to get benchmark status:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, benchmarkData?.status, setBenchmarkData]);

  const handleRunBenchmark = async () => {
    if (!sessionId || !isAuditCompleted) return;

    setIsRunning(true);
    setError(null);

    try {
      const response = await startBenchmark(sessionId);
      setBenchmarkData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start benchmark");
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <h2 className="font-semibold text-foreground">LLM Readiness</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Test if your site can answer common questions
        </p>
      </div>

      {/* Benchmark Controls */}
      <div className="p-4 border-b border-border/30">
        <Button
          onClick={handleRunBenchmark}
          disabled={!isAuditCompleted || isBenchmarkRunning}
          className="w-full gap-2"
          variant={isBenchmarkCompleted ? "outline" : "default"}
        >
          {isBenchmarkRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Benchmark...
            </>
          ) : isBenchmarkCompleted ? (
            <>
              <Play className="w-4 h-4" />
              Re-run Benchmark
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run LLM Benchmark
            </>
          )}
        </Button>
        {!isAuditCompleted && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Complete the audit first to run benchmark
          </p>
        )}
        {error && (
          <p className="text-xs text-red-500 mt-2 text-center">{error}</p>
        )}
      </div>

      {/* Accordion sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Overall Scores */}
        {isBenchmarkCompleted && benchmarkData?.overall_scores && (
          <AccordionSection
            title="Overall Scores"
            defaultOpen={true}
            badge={
              <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                {Math.round(benchmarkData.overall_scores.answerability_rate * 100)}%
              </span>
            }
          >
            <ScoreBar
              label="Answerability Rate"
              value={benchmarkData.overall_scores.answerability_rate}
              color="success"
            />
            <ScoreBar
              label="Citation Coverage"
              value={benchmarkData.overall_scores.citation_coverage}
              color="primary"
            />
            <ScoreBar
              label="Completeness"
              value={benchmarkData.overall_scores.completeness}
              color="primary"
            />
            <ScoreBar
              label="Hallucination Rate"
              value={benchmarkData.overall_scores.hallucination_rate}
              color="warning"
            />

            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div className="p-2 rounded bg-muted/30 text-center">
                <span className="text-muted-foreground">Pages Crawled</span>
                <p className="text-foreground font-bold">{benchmarkData.crawled_pages || 0}</p>
              </div>
              <div className="p-2 rounded bg-muted/30 text-center">
                <span className="text-muted-foreground">Chunks Indexed</span>
                <p className="text-foreground font-bold">{benchmarkData.indexed_chunks || 0}</p>
              </div>
            </div>
          </AccordionSection>
        )}

        {/* Questions & Results */}
        <AccordionSection
          title="Benchmark Questions"
          defaultOpen={true}
          badge={
            isBenchmarkCompleted && benchmarkData?.query_results ? (
              <span className="text-xs text-muted-foreground">
                {benchmarkData.query_results.filter(r => r.status === "answered").length}/{benchmarkData.query_results.length}
              </span>
            ) : null
          }
        >
          {isBenchmarkRunning && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Analyzing site content...</span>
            </div>
          )}

          {isBenchmarkCompleted && benchmarkData?.query_results ? (
            <div className="space-y-2">
              {benchmarkData.query_results.map((result, index) => (
                <QuestionItem key={index} result={result} />
              ))}
            </div>
          ) : !isBenchmarkRunning && (
            <div className="space-y-2">
              {questions && questions.length > 0 ? (
                questions.map((question, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-muted/20 border border-border/30"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">{question}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Loading benchmark questions...
                </p>
              )}
            </div>
          )}
        </AccordionSection>

        {/* Missing Topics */}
        {isBenchmarkCompleted && benchmarkData?.missing_topics && benchmarkData.missing_topics.length > 0 && (
          <AccordionSection title="Missing Topics" defaultOpen={false}>
            <div className="space-y-2">
              {benchmarkData.missing_topics.map((topic, index) => (
                <div
                  key={index}
                  className="p-2 rounded bg-red-500/10 border border-red-500/20 text-sm text-red-400"
                >
                  {topic}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Consider adding content to address these topics for better LLM accessibility.
            </p>
          </AccordionSection>
        )}
      </div>
    </div>
  );
}
