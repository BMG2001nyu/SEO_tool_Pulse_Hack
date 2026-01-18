import { useMemo, useState } from "react";
import { Download, RefreshCw, Loader2, AlertCircle, CheckCircle2, ExternalLink, ChevronDown, FileText, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreMeter } from "./ScoreMeter";
import { CoreWebVitalsChart } from "./charts/CoreWebVitalsChart";
import { MetaTagsChart } from "./charts/MetaTagsChart";
import { BrokenLinksChart } from "./charts/BrokenLinksChart";
import { AuditData, AuditStatusResponse } from "@/lib/api";

function LlmContextSection({ llmstxtContent }: { llmstxtContent?: string | null }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!llmstxtContent) {
    return (
      <Card className="bg-card/50 border-border/50 mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            LLM Context File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            LLM context file was not generated. This may be due to timeout or API limitations.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(llmstxtContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = llmstxtContent.split(/\s+/).length;
  const charCount = llmstxtContent.length;

  return (
    <Card className="bg-card/50 border-border/50 mb-6 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            LLM Context File
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {wordCount.toLocaleString()} words / {charCount.toLocaleString()} chars
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors mb-2"
        >
          <span className="text-sm text-muted-foreground">
            {isExpanded ? "Hide content" : "Show content"}
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        </button>

        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden w-full"
          >
            <pre className="text-xs text-muted-foreground bg-muted/20 p-4 rounded-lg overflow-x-auto overflow-y-auto max-h-96 w-full whitespace-pre-wrap break-all font-mono">
              {llmstxtContent}
            </pre>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

interface ReportViewerPanelProps {
  auditUrl?: string | null;
  auditData?: AuditData | null;
  auditStatus?: AuditStatusResponse | null;
  onDownloadReport?: () => void;
  onExportJson?: () => void;
}

export function ReportViewerPanel({ auditUrl, auditData, auditStatus, onDownloadReport, onExportJson }: ReportViewerPanelProps) {
  // Extract domain from URL for display
  const displayUrl = auditUrl ? (() => {
    try {
      return new URL(auditUrl).hostname;
    } catch {
      return auditUrl;
    }
  })() : "Waiting...";

  // Calculate metrics from audit data
  const metrics = useMemo(() => {
    if (!auditData?.items) return null;

    const items = auditData.items;
    const totalPages = items.length;

    let pagesWithTitle = 0;
    let pagesWithH1 = 0;
    let pagesWithDescription = 0;
    let pagesWithoutAlt = 0;
    let totalImages = 0;
    let totalLinks = 0;
    let brokenLinks = 0;
    let totalRequestTime = 0;
    let totalDomSize = 0;
    let totalHtmlSize = 0;
    let statusCodes: Record<number, number> = {};

    items.forEach((item) => {
      if (item.title) pagesWithTitle++;
      if (item.h1) pagesWithH1++;
      if (item.description) pagesWithDescription++;
      if (item.images_without_alt) pagesWithoutAlt += item.images_without_alt;
      if (item.images) totalImages += item.images;
      if (item.links) totalLinks += item.links;
      if (item.status >= 400) brokenLinks++;
      if (item.request_time) totalRequestTime += item.request_time;
      if (item.dom_size) totalDomSize += item.dom_size;
      if (item.html_size) totalHtmlSize += item.html_size;

      const status = item.status || 0;
      statusCodes[status] = (statusCodes[status] || 0) + 1;
    });

    // Calculate scores as percentages
    const titleScorePercent = Math.round((pagesWithTitle / totalPages) * 100);
    const h1ScorePercent = Math.round((pagesWithH1 / totalPages) * 100);
    const descScorePercent = Math.round((pagesWithDescription / totalPages) * 100);
    const altScorePercent = totalImages > 0 ? Math.round(((totalImages - pagesWithoutAlt) / totalImages) * 100) : 100;

    // Calculate SEO score (simple heuristic)
    const seoScore = Math.round((titleScorePercent + h1ScorePercent + descScorePercent + altScorePercent) / 4);

    // Calculate link health
    const linkHealthScore = totalPages > 0 ? Math.round(((totalPages - brokenLinks) / totalPages) * 100) : 100;

    return {
      totalPages,
      pagesWithTitle,
      pagesWithH1,
      pagesWithDescription,
      pagesWithoutAlt,
      totalImages,
      totalLinks,
      brokenLinks,
      statusCodes,
      seoScore,
      titleScorePercent,
      h1ScorePercent,
      descScorePercent,
      altScorePercent,
      linkHealthScore,
      avgRequestTime: totalPages > 0 ? totalRequestTime / totalPages : 0,
      avgDomSize: totalPages > 0 ? totalDomSize / totalPages : 0,
      avgHtmlSize: totalPages > 0 ? totalHtmlSize / totalPages : 0,
    };
  }, [auditData]);

  const isLoading = auditStatus?.status === "pending" || auditStatus?.status === "running";
  const isFailed = auditStatus?.status === "failed";
  const isCompleted = auditStatus?.status === "completed";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">SEO Audit Report</h1>
          {isLoading && (
            <span className="flex items-center gap-2 text-sm text-yellow-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              {auditStatus?.message || "Analyzing..."}
            </span>
          )}
          {isFailed && (
            <span className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="w-4 h-4" />
              Failed
            </span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle2 className="w-4 h-4" />
              Complete
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary/50 text-primary hover:bg-primary/10"
          disabled={!auditData}
          onClick={onDownloadReport}
        >
          <Download className="w-4 h-4" />
          Download Report
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* URL Display */}
          <div className="mb-6 p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Auditing:</span>
              <a
                href={auditUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-medium flex items-center gap-1 hover:text-primary transition-colors"
              >
                {displayUrl}
                <ExternalLink className="w-3 h-3" />
              </a>
              {metrics && (
                <span className="text-muted-foreground ml-auto">
                  {metrics.totalPages} pages scanned
                </span>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-lg text-foreground mb-2">{auditStatus?.message || "Running audit..."}</p>
              <p className="text-sm text-muted-foreground">This may take a few minutes</p>
              <div className="w-64 h-2 bg-muted rounded-full mt-4 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${auditStatus?.progress || 0}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {isFailed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-lg text-foreground mb-2">Audit Failed</p>
              <p className="text-sm text-muted-foreground">{auditStatus?.error || "An error occurred"}</p>
            </motion.div>
          )}

          {/* Results */}
          {isCompleted && metrics && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <CoreWebVitalsChart
                  avgRequestTime={metrics.avgRequestTime}
                  avgDomSize={metrics.avgDomSize}
                  avgHtmlSize={metrics.avgHtmlSize}
                />
                <MetaTagsChart
                  titleScore={metrics.titleScorePercent}
                  h1Score={metrics.h1ScorePercent}
                  descriptionScore={metrics.descScorePercent}
                  altScore={metrics.altScorePercent}
                />
                <BrokenLinksChart
                  totalLinks={metrics.totalLinks}
                  brokenLinks={metrics.brokenLinks}
                  healthScore={metrics.linkHealthScore}
                />
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pages Scanned</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-foreground">{metrics.totalPages}</p>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Links</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-foreground">{metrics.totalLinks}</p>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Images</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-foreground">{metrics.totalImages}</p>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg Load Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-foreground">{Math.round(metrics.avgRequestTime)}ms</p>
                  </CardContent>
                </Card>
              </div>

              {/* Pages Table */}
              <Card className="bg-card/50 border-border/50 mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Pages Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-2 text-muted-foreground font-medium">URL</th>
                          <th className="text-left py-2 px-2 text-muted-foreground font-medium">Status</th>
                          <th className="text-left py-2 px-2 text-muted-foreground font-medium">Title</th>
                          <th className="text-left py-2 px-2 text-muted-foreground font-medium">H1</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditData.items.slice(0, 10).map((item, index) => (
                          <tr key={index} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="py-2 px-2 text-foreground truncate max-w-[200px]">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary"
                              >
                                {item.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                              </a>
                            </td>
                            <td className="py-2 px-2">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  item.status >= 200 && item.status < 300
                                    ? "bg-green-500/20 text-green-400"
                                    : item.status >= 300 && item.status < 400
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : "bg-red-500/20 text-red-400"
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-muted-foreground truncate max-w-[200px]">
                              {item.title || <span className="text-red-400">Missing</span>}
                            </td>
                            <td className="py-2 px-2 text-muted-foreground truncate max-w-[150px]">
                              {item.h1 || <span className="text-red-400">Missing</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {auditData.items.length > 10 && (
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        Showing 10 of {auditData.items.length} pages
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* LLM Context File */}
              <LlmContextSection llmstxtContent={auditStatus?.llmstxt_content} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="p-4 border-t border-border/50 flex items-center justify-between">
        <Button variant="outline" size="sm" className="gap-2" disabled={isLoading}>
          <RefreshCw className="w-4 h-4" />
          Re-scan Website
        </Button>

        {/* Score meter */}
        <ScoreMeter score={metrics?.seoScore ?? 0} label="SEO HEALTH" />

        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary/50 text-primary hover:bg-primary/10"
          disabled={!auditData}
          onClick={onExportJson}
        >
          <Download className="w-4 h-4" />
          Export JSON
        </Button>
      </div>
    </div>
  );
}
