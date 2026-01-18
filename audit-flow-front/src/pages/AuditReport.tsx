import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { StudioLayout } from "@/components/layout/StudioLayout";
import { AIAssistantPanel } from "@/components/panels/AIAssistantPanel";
import { ReportViewerPanel } from "@/components/panels/ReportViewerPanel";
import { AuditControlsPanel } from "@/components/panels/AuditControlsPanel";
import { useAudit } from "@/context/AuditContext";
import { getAuditStatus } from "@/lib/api";

const AuditReport = () => {
  const [searchParams] = useSearchParams();
  const sessionParam = searchParams.get("session");

  const {
    sessionId,
    setSessionId,
    auditStatus,
    setAuditStatus,
    auditData,
    setAuditData,
    auditUrl,
    setAuditUrl,
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

  return (
    <div className="dark">
      <StudioLayout
        leftPanel={<AIAssistantPanel sessionId={currentSessionId} />}
        centerPanel={
          <ReportViewerPanel
            auditUrl={auditUrl}
            auditData={auditData}
            auditStatus={auditStatus}
          />
        }
        rightPanel={<AuditControlsPanel />}
        progress={progress}
      />
    </div>
  );
};

export default AuditReport;
