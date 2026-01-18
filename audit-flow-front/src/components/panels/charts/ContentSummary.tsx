interface ContentSummaryProps {
  title: string;
  variant: "left" | "right";
}

export function ContentSummary({ title, variant }: ContentSummaryProps) {
  return (
    <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
            {variant === "left" ? "● Generating Process A/interest" : "■ Colinfrance"}
          </span>
        </div>
      </div>
      
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      
      <p className="text-xs text-muted-foreground leading-relaxed">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonumod tempor 
        incididunt ut eros eda duisle miege honasquips lusin/erpera eum sumuer 
        molodolomal/autornm'oruirmagis arque. Ut ewnrnid minion-ocosere, horae wereoretamtehe 
        diievorsmesgusrsurinemds oos avemrerdoreve sentnns oois emt dkum ocane 
        odlerefrempotie bsiasvem/erprnorn mivoreo factan uiforere dus firtrs int allern ore at
      </p>

      <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary" />
          Content Summary
        </span>
      </div>
    </div>
  );
}
