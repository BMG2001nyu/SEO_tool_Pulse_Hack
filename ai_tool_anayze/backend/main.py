from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl

from backend.benchmark import run_answerability_benchmark

app = FastAPI(title="SEO Tool Backend")


class AnalyzeRequest(BaseModel):
    url: HttpUrl


@app.post("/analyze")
def analyze_site(payload: AnalyzeRequest):
    # Lighthouse would run here. Placeholder until wired up.
    lighthouse_report = {"status": "todo"}
    benchmark = run_answerability_benchmark(str(payload.url))
    return {"received_url": str(payload.url), "lighthouse": lighthouse_report, "benchmark": benchmark}


@app.get("/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
