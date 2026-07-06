import { useState, useEffect } from "react";
import { Download, Loader2, Play, RefreshCw, X } from "lucide-react";
import {
  createAnimationJob,
  getAllAnimationJobsByUser,
  getDownloadFileSignedURL,
  retryAnimationJob,
  useQuery,
} from "wasp/client/operations";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { Textarea } from "../client/components/ui/textarea";
import { cn } from "../client/utils";

export function VideoConvertPage() {
  const [prompt, setPrompt] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const { data: jobs, isLoading: isJobsLoading, refetch } = useQuery(getAllAnimationJobsByUser);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    try {
      setIsGenerating(true);
      await createAnimationJob({ prompt });
      setPrompt("");
      await refetch();
    } catch (error) {
      console.error("Failed to create animation job:", error);
      alert("Failed to create animation job. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      await retryAnimationJob({ id: jobId });
      await refetch();
    } catch (error) {
      console.error("Failed to retry animation job:", error);
      alert("Failed to retry animation job. Please try again.");
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);

    return () => clearInterval(interval);
  }, [refetch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "failed":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "generating":
      case "recording":
      case "processing":
        return "bg-primary/10 text-primary border-primary/20";
      default:
        return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "generating":
        return "Generating HTML";
      case "recording":
        return "Recording video";
      case "processing":
        return "Processing";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      default:
        return status;
    }
  };

  const handleDownloadWebm = async (s3Key: string) => {
    try {
      const url = await getDownloadFileSignedURL({ s3Key });
      window.open(url, "_blank");
    } catch (error) {
      console.error("Failed to get download URL:", error);
    }
  };

  return (
    <div className="py-10 lg:mt-10">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-foreground mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-primary">AI</span> Animation to Video
          </h2>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-center text-lg leading-8">
            Generate HTML animations with AI and convert them to video format.
            Enter a prompt to create beautiful animations.
          </p>
        </div>

        <Card className="bg-muted/10 my-8">
          <CardContent className="mx-auto my-8 space-y-6 px-6 py-10 sm:w-[90%] md:w-[70%] lg:w-[50%]">
            <div className="space-y-3">
              <Label htmlFor="prompt" className="text-muted-foreground text-sm font-semibold">
                Animation Prompt
              </Label>
              <Textarea
                id="prompt"
                placeholder="Describe the animation you want to create...
e.g., A colorful bouncing ball with shadow effects
or: A spinning gradient circle with particles"
                value={prompt}
                onChange={(e) => setPrompt(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    handleSubmit();
                  }
                }}
                className="min-h-[120px] resize-none"
              />
              <p className="text-muted-foreground text-xs">
                Press Ctrl + Enter to submit
              </p>
            </div>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!prompt.trim() || isGenerating}
              variant="default"
              size="default"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 inline-block animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Animation"
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="text-foreground text-lg font-semibold">
            Your Animation Jobs
          </h3>
          
          {isJobsLoading ? (
            <div className="text-muted-foreground text-center py-8">Loading...</div>
          ) : jobs && jobs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <Card key={job.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base line-clamp-2">
                        {job.prompt}
                      </CardTitle>
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium border",
                          getStatusColor(job.status)
                        )}
                      >
                        {getStatusText(job.status)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {job.status === "completed" && job.webmS3Key && (
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadWebm(job.webmS3Key)}
                          className="w-full"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download WebM
                        </Button>
                        {job.m3u8S3Key && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadWebm(job.m3u8S3Key)}
                            className="w-full"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download HLS (m3u8)
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {job.status === "failed" && (
                      <div className="space-y-2">
                        <p className="text-destructive text-sm">{job.error}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(job.id)}
                          className="w-full"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Retry
                        </Button>
                      </div>
                    )}
                    
                    <p className="text-muted-foreground text-xs">
                      Created: {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-center py-12">
              No animation jobs yet. Create your first animation above!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
