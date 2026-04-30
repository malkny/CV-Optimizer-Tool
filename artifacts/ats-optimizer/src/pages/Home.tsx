import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, RefreshCw, Download, ChevronRight, X, Loader2 } from "lucide-react";
import { useOptimizeCv } from "@workspace/api-client-react";
import { toast } from "sonner";
import { z } from "zod";
import { 
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

type Phase = "idle" | "processing" | "success" | "error";

const PROCESSING_STEPS = [
  "Parsing CV",
  "Analyzing JD",
  "Optimizing Content",
  "Generating Files",
  "Complete"
];

function Gauge({ value }: { value: number }) {
  const data = [{ name: "Score", value }];
  
  // Color logic
  let color = "hsl(var(--destructive))";
  if (value >= 90) color = "hsl(var(--primary))";
  else if (value >= 70) color = "hsl(25 80% 55%)"; // chart-2

  return (
    <div className="relative w-48 h-48 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart 
          cx="50%" cy="50%" 
          innerRadius="70%" outerRadius="90%" 
          barSize={16} data={data} 
          startAngle={180} endAngle={0}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: "hsl(var(--muted))" }}
            dataKey="value"
            cornerRadius={8}
            fill={color}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
        <span className="text-5xl font-serif font-bold text-foreground">{value}</span>
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Match</span>
      </div>
    </div>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  let color = "bg-destructive";
  if (value >= 90) color = "bg-primary";
  else if (value >= 70) color = "bg-[hsl(25,80%,55%)]";
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-serif font-semibold">{value}/100</span>
      </div>
      <Progress value={value} className="h-2" indicatorClassName={color} />
    </div>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  
  // Inputs
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jdMode, setJdMode] = useState<"text" | "url">("text");
  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  
  // Validation
  const [fileError, setFileError] = useState("");
  const [jdError, setJdError] = useState("");

  // Processing state
  const [currentStep, setCurrentStep] = useState(0);

  // Mutation
  const optimizeMutation = useOptimizeCv();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileError("");
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError("Please upload a PDF or DOCX file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File must be smaller than 5MB.");
      return;
    }
    setCvFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const validateForm = () => {
    let valid = true;
    if (!cvFile) {
      setFileError("A CV file is required.");
      valid = false;
    }
    
    if (jdMode === "text") {
      if (jdText.length < 50) {
        setJdError("Job description must be at least 50 characters.");
        valid = false;
      } else if (jdText.length > 5000) {
        setJdError("Job description cannot exceed 5000 characters.");
        valid = false;
      } else {
        setJdError("");
      }
    } else {
      try {
        new URL(jdUrl);
        if (!jdUrl.startsWith("https://")) {
          setJdError("URL must use HTTPS.");
          valid = false;
        } else {
          setJdError("");
        }
      } catch {
        setJdError("Please enter a valid URL.");
        valid = false;
      }
    }
    return valid;
  };

  const handleOptimize = () => {
    if (!validateForm()) return;
    
    setPhase("processing");
    setCurrentStep(0);
    
    // Simulate steps progression
    const stepInterval = setInterval(() => {
      setCurrentStep(s => {
        if (s >= PROCESSING_STEPS.length - 2) {
          clearInterval(stepInterval);
          return s;
        }
        return s + 1;
      });
    }, 4000);

    optimizeMutation.mutate({
      data: {
        cv: cvFile!,
        ...(jdMode === "text" ? { jdText } : { jdUrl })
      }
    }, {
      onSuccess: () => {
        clearInterval(stepInterval);
        setCurrentStep(PROCESSING_STEPS.length - 1);
        setTimeout(() => setPhase("success"), 600);
      },
      onError: (err) => {
        clearInterval(stepInterval);
        setPhase("error");
        toast.error("Optimization failed", {
          description: err.data?.error || "An unexpected error occurred. Please try again."
        });
      }
    });
  };

  const handleReset = () => {
    setPhase("idle");
    setCvFile(null);
    setJdText("");
    setJdUrl("");
    optimizeMutation.reset();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      {/* Decorative background */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: 'url(/hero-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />

      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 py-10 md:py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-4 tracking-tight">
          ATS CV Optimizer
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
          A precision tool for serious candidates. Align your résumé with the exact requirements of your target role.
        </p>
      </header>

      <main className="relative z-10 flex-grow w-full max-w-4xl mx-auto px-4 pb-20 flex flex-col items-center">
        <AnimatePresence mode="wait">
          
          {phase === "idle" && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                
                {/* Left Column: CV Upload */}
                <div className="space-y-4">
                  <h2 className="text-xl font-serif font-medium flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm">1</span>
                    Your Résumé
                  </h2>
                  <Card className="border-border shadow-sm">
                    <CardContent className="p-6">
                      {!cvFile ? (
                        <div 
                          className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer hover:bg-muted/50 ${fileError ? 'border-destructive' : 'border-border'}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <UploadCloud className="w-10 h-10 text-muted-foreground mb-4" />
                          <p className="font-medium text-foreground mb-1">Click or drag file to upload</p>
                          <p className="text-sm text-muted-foreground">PDF or DOCX up to 5MB</p>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleFile(e.target.files[0]);
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                            <div className="overflow-hidden">
                              <p className="font-medium truncate text-foreground">{cvFile.name}</p>
                              <p className="text-sm text-muted-foreground">{(cvFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setCvFile(null)} className="text-muted-foreground hover:text-destructive">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      {fileError && <p className="text-sm text-destructive mt-3 flex items-center gap-1"><AlertCircle className="w-4 h-4"/> {fileError}</p>}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Job Description */}
                <div className="space-y-4">
                  <h2 className="text-xl font-serif font-medium flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm">2</span>
                    Job Description
                  </h2>
                  <Card className="border-border shadow-sm h-full flex flex-col">
                    <CardContent className="p-6 flex-grow flex flex-col">
                      <Tabs value={jdMode} onValueChange={(v) => setJdMode(v as any)} className="w-full flex-grow flex flex-col">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                          <TabsTrigger value="text">Paste Text</TabsTrigger>
                          <TabsTrigger value="url">From URL</TabsTrigger>
                        </TabsList>
                        <TabsContent value="text" className="flex-grow flex flex-col m-0 data-[state=inactive]:hidden">
                          <div className="relative flex-grow flex flex-col">
                            <Textarea 
                              placeholder="Paste the full job description here..."
                              className={`resize-none flex-grow min-h-[200px] ${jdError && jdMode === 'text' ? 'border-destructive' : ''}`}
                              value={jdText}
                              onChange={(e) => {
                                setJdText(e.target.value);
                                setJdError("");
                              }}
                            />
                            <div className="absolute bottom-3 right-3 text-xs font-medium text-muted-foreground bg-background/80 px-2 py-1 rounded">
                              <span className={jdText.length > 5000 ? "text-destructive" : ""}>{jdText.length}</span> / 5000
                            </div>
                          </div>
                        </TabsContent>
                        <TabsContent value="url" className="flex-grow m-0 data-[state=inactive]:hidden">
                          <div className="space-y-2">
                            <Label htmlFor="url">Posting URL (HTTPS only)</Label>
                            <Input 
                              id="url"
                              type="url" 
                              placeholder="https://company.com/careers/job"
                              value={jdUrl}
                              className={jdError && jdMode === 'url' ? 'border-destructive' : ''}
                              onChange={(e) => {
                                setJdUrl(e.target.value);
                                setJdError("");
                              }}
                            />
                          </div>
                        </TabsContent>
                      </Tabs>
                      {jdError && <p className="text-sm text-destructive mt-3 flex items-center gap-1"><AlertCircle className="w-4 h-4"/> {jdError}</p>}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex justify-center pt-6 border-t border-border">
                <Button 
                  size="lg" 
                  className="font-serif text-lg px-12 py-6 rounded-full shadow-md hover:shadow-lg transition-all"
                  onClick={handleOptimize}
                  disabled={!cvFile || (jdMode === "text" ? jdText.length < 50 : !jdUrl)}
                >
                  Optimize Résumé <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "processing" && (
            <motion.div 
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl py-20 flex flex-col items-center justify-center text-center"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-8" />
              <h2 className="text-2xl font-serif mb-12">Crafting your tailored response</h2>
              
              <div className="w-full relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -translate-y-1/2 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary"
                    initial={{ width: "0%" }}
                    animate={{ width: `${(currentStep / (PROCESSING_STEPS.length - 1)) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                
                <div className="relative flex justify-between w-full">
                  {PROCESSING_STEPS.map((step, i) => (
                    <div key={step} className="flex flex-col items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium z-10 transition-colors duration-500
                        ${i < currentStep ? 'bg-primary text-primary-foreground' : 
                          i === currentStep ? 'bg-background border-2 border-primary text-primary' : 
                          'bg-background border-2 border-muted text-muted-foreground'}`}
                      >
                        {i < currentStep ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                      </div>
                      <span className={`text-xs font-medium w-24 text-center transition-colors duration-500
                        ${i <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {phase === "error" && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md mx-auto text-center space-y-6 py-12"
            >
              <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-2xl font-serif font-medium mb-2">Analysis Failed</h2>
                <p className="text-muted-foreground">
                  {optimizeMutation.error?.data?.error || "We couldn't process the documents. Please try again."}
                </p>
              </div>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={handleReset}>Start Over</Button>
                <Button onClick={handleOptimize}>Try Again <RefreshCw className="w-4 h-4 ml-2" /></Button>
              </div>
            </motion.div>
          )}

          {phase === "success" && optimizeMutation.data && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-8"
            >
              {/* Header with Name/Role if extracted */}
              {(optimizeMutation.data.candidateName || optimizeMutation.data.jobTitle) && (
                <div className="text-center mb-8 pb-8 border-b border-border">
                  <h2 className="text-3xl font-serif mb-2">{optimizeMutation.data.candidateName || "Candidate"}</h2>
                  {optimizeMutation.data.jobTitle && <p className="text-xl text-muted-foreground">for {optimizeMutation.data.jobTitle}</p>}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Score Column */}
                <Card className="col-span-1 border-border shadow-sm flex flex-col">
                  <CardHeader className="text-center pb-0">
                    <CardTitle className="font-serif text-xl">ATS Match Score</CardTitle>
                    <CardDescription>Target: 90-95</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 pb-8 flex-grow flex flex-col items-center justify-center border-b border-border/50">
                    <Gauge value={optimizeMutation.data.atsScore} />
                  </CardContent>
                  <CardContent className="pt-6 space-y-6">
                    <MiniBar label="Keywords" value={optimizeMutation.data.breakdown.keywords} />
                    <MiniBar label="Experience Alignment" value={optimizeMutation.data.breakdown.experience} />
                    <MiniBar label="Formatting" value={optimizeMutation.data.breakdown.formatting} />
                    <MiniBar label="Completeness" value={optimizeMutation.data.breakdown.completeness} />
                  </CardContent>
                </Card>

                {/* Analysis Column */}
                <div className="col-span-1 lg:col-span-2 space-y-8">
                  <Card className="border-border shadow-sm">
                    <CardHeader>
                      <CardTitle className="font-serif text-xl">Optimization Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      <div>
                        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" /> Top Improvements
                        </h4>
                        <ul className="space-y-2">
                          {optimizeMutation.data.summary.topImprovements.map((item, i) => (
                            <li key={i} className="text-muted-foreground text-sm pl-6 relative">
                              <span className="absolute left-2 top-2 w-1.5 h-1.5 rounded-full bg-border" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-[hsl(25,80%,55%)]" /> Missing Keywords Added
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {optimizeMutation.data.summary.missingKeywords.map((kw, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium border border-border">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                          <ChevronRight className="w-4 h-4 text-primary" /> Recommended Next Steps
                        </h4>
                        <ul className="space-y-2">
                          {optimizeMutation.data.summary.nextSteps.map((item, i) => (
                            <li key={i} className="text-muted-foreground text-sm pl-6 relative">
                              <span className="absolute left-2 top-2 w-1.5 h-1.5 rounded-full bg-border" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border shadow-sm bg-muted/20">
                    <CardHeader>
                      <CardTitle className="font-serif text-xl">Your Documents</CardTitle>
                      <CardDescription>Download your tailored assets</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <a href={optimizeMutation.data.downloads.cvPdf} download className="block">
                        <Button variant="outline" className="w-full justify-start h-auto py-4 px-4 bg-background">
                          <FileText className="w-5 h-5 mr-3 text-primary" />
                          <div className="text-left flex-grow">
                            <div className="font-medium">Optimized CV</div>
                            <div className="text-xs text-muted-foreground">PDF Format</div>
                          </div>
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </a>
                      <a href={optimizeMutation.data.downloads.cvDocx} download className="block">
                        <Button variant="outline" className="w-full justify-start h-auto py-4 px-4 bg-background">
                          <FileText className="w-5 h-5 mr-3 text-primary" />
                          <div className="text-left flex-grow">
                            <div className="font-medium">Optimized CV</div>
                            <div className="text-xs text-muted-foreground">DOCX Format</div>
                          </div>
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </a>
                      <a href={optimizeMutation.data.downloads.coverLetterPdf} download className="block">
                        <Button variant="outline" className="w-full justify-start h-auto py-4 px-4 bg-background">
                          <FileText className="w-5 h-5 mr-3 text-[hsl(25,80%,55%)]" />
                          <div className="text-left flex-grow">
                            <div className="font-medium">Tailored Cover Letter</div>
                            <div className="text-xs text-muted-foreground">PDF Format</div>
                          </div>
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </a>
                      <a href={optimizeMutation.data.downloads.coverLetterDocx} download className="block">
                        <Button variant="outline" className="w-full justify-start h-auto py-4 px-4 bg-background">
                          <FileText className="w-5 h-5 mr-3 text-[hsl(25,80%,55%)]" />
                          <div className="text-left flex-grow">
                            <div className="font-medium">Tailored Cover Letter</div>
                            <div className="text-xs text-muted-foreground">DOCX Format</div>
                          </div>
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </a>
                    </CardContent>
                  </Card>
                  
                  <div className="flex justify-end">
                     <Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
                        <RefreshCw className="w-4 h-4 mr-2" /> Start Over
                     </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <footer className="relative z-10 py-6 text-center border-t border-border mt-auto">
        <p className="text-xs text-muted-foreground max-w-xl mx-auto px-4">
          All documents are processed in memory and permanently purged from our servers after 15 minutes. 
          We do not store your data or use it to train AI models.
        </p>
      </footer>
    </div>
  );
}