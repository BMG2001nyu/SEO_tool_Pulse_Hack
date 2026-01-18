interface MetaTagsChartProps {
  titleScore?: number;
  h1Score?: number;
  descriptionScore?: number;
  altScore?: number;
}

export function MetaTagsChart({ titleScore = 0, h1Score = 0, descriptionScore = 0, altScore = 0 }: MetaTagsChartProps) {
  const data = [
    { name: "Page Titles", value: titleScore },
    { name: "H1 Tags", value: h1Score },
    { name: "Meta Descriptions", value: descriptionScore },
    { name: "Image Alt Tags", value: altScore },
  ];
  return (
    <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-foreground">Meta Tags Analysis</h3>
        <span className="text-muted-foreground text-xs">ⓘ</span>
      </div>

      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{item.name}</span>
              <span className="text-foreground font-medium">{item.value}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>Meta</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-muted-foreground" />
          <span>Text</span>
        </div>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        <span>Distant <span className="text-foreground">100</span>satisfactory</span>
        <span className="ml-4">70%</span>
      </div>
    </div>
  );
}
