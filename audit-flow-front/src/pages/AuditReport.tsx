import { useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { AIAssistantPanel } from "@/components/panels/AIAssistantPanel";
import { ReportViewerPanel } from "@/components/panels/ReportViewerPanel";
import { AuditControlsPanel } from "@/components/panels/AuditControlsPanel";
import { useAudit } from "@/context/AuditContext";
import { getAuditStatus } from "@/lib/api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const AuditReport = () => {
  const [searchParams] = useSearchParams();
  const sessionParam = searchParams.get("session");
  const centerPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const {
    sessionId,
    setSessionId,
    auditStatus,
    setAuditStatus,
    auditData,
    setAuditData,
    auditUrl,
    setAuditUrl,
    benchmarkData,
  } = useAudit();

  // Use session from URL if context is empty
  const currentSessionId = sessionId || sessionParam;

  useEffect(() => {
    if (sessionParam && !sessionId) {
      setSessionId(sessionParam);
    }
  }, [sessionParam, sessionId, setSessionId]);

  // Poll for audit status
  useEffect(() => {
    if (!currentSessionId) return;

    const pollStatus = async () => {
      try {
        const status = await getAuditStatus(currentSessionId);
        setAuditStatus(status);

        if (status.audit_data) {
          setAuditData(status.audit_data);
          if (status.audit_data.scan?.url) {
            setAuditUrl(status.audit_data.scan.url);
          }
        }

        // Continue polling if not complete
        if (status.status === "pending" || status.status === "running") {
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        console.error("Failed to get audit status:", error);
      }
    };

    pollStatus();
  }, [currentSessionId, setAuditStatus, setAuditData, setAuditUrl]);

  const progress = auditStatus?.progress ?? 0;

  const handleDownloadReport = useCallback(async () => {
    if (!centerPanelRef.current || !rightPanelRef.current) return;

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      // Add title
      const domain = auditUrl ? new URL(auditUrl).hostname : "Website";
      pdf.setFontSize(20);
      pdf.setTextColor(138, 43, 226); // Purple color
      pdf.text(`SEO Audit Report`, margin, 20);
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${domain} - ${new Date().toLocaleDateString()}`, margin, 28);

      let yOffset = 40;

      // Capture center panel (main report)
      const centerCanvas = await html2canvas(centerPanelRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#1a1a2e",
        logging: false,
        allowTaint: true,
      });

      // Validate canvas dimensions
      if (centerCanvas.width > 0 && centerCanvas.height > 0) {
        const centerImgData = centerCanvas.toDataURL("image/jpeg", 0.95);
        const centerImgWidth = pageWidth - margin * 2;
        const centerImgHeight = (centerCanvas.height * centerImgWidth) / centerCanvas.width;

        // Add center panel image
        const maxHeight = pageHeight - yOffset - margin;
        if (centerImgWidth > 0 && centerImgHeight > 0) {
          pdf.addImage(
            centerImgData,
            "JPEG",
            margin,
            yOffset,
            centerImgWidth,
            Math.min(centerImgHeight, maxHeight)
          );
        }
      }

      // Add new page for benchmark results
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.setTextColor(138, 43, 226);
      pdf.text("LLM Readiness Benchmark", margin, 20);

      // Capture right panel (benchmark)
      const rightCanvas = await html2canvas(rightPanelRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#1a1a2e",
        logging: false,
        allowTaint: true,
      });

      // Validate canvas dimensions
      if (rightCanvas.width > 0 && rightCanvas.height > 0) {
        const rightImgData = rightCanvas.toDataURL("image/jpeg", 0.95);
        const rightImgWidth = pageWidth - margin * 2;
        const rightImgHeight = (rightCanvas.height * rightImgWidth) / rightCanvas.width;

        // Add right panel image
        if (rightImgWidth > 0 && rightImgHeight > 0) {
          pdf.addImage(
            rightImgData,
            "JPEG",
            margin,
            30,
            rightImgWidth,
            Math.min(rightImgHeight, pageHeight - 40)
          );
        }
      }

      // Save PDF
      pdf.save(`seo-audit-${domain}-${Date.now()}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  }, [auditUrl]);

  const handleExportJson = useCallback(() => {
    if (!auditData) return;

    const exportData = {
      url: auditUrl,
      timestamp: new Date().toISOString(),
      audit: auditData,
      benchmark: benchmarkData || null,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const domain = auditUrl ? new URL(auditUrl).hostname : "website";
    a.download = `seo-audit-${domain}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [auditData, auditUrl, benchmarkData]);

  return (
    <div className="dark">
      <StudioLayout
        leftPanel={<AIAssistantPanel sessionId={currentSessionId} />}
        centerPanel={
          <div ref={centerPanelRef} className="h-full">
            <ReportViewerPanel
              auditUrl={auditUrl}
              auditData={auditData}
              auditStatus={auditStatus}
              onDownloadReport={handleDownloadReport}
              onExportJson={handleExportJson}
            />
          </div>
        }
        rightPanel={
          <div ref={rightPanelRef} className="h-full">
            <AuditControlsPanel />
          </div>
        }
        progress={progress}
      />
    </div>
  );
};

export default AuditReport;
