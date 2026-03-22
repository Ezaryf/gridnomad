import { cn } from "@/lib/utils";


function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl",
        className
      )}
      {...props}
    />
  );
}


function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}


function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-base font-semibold tracking-tight text-zinc-50", className)} {...props} />;
}


function CardDescription({ className, ...props }) {
  return <p className={cn("text-sm leading-6 text-zinc-400", className)} {...props} />;
}


function CardContent({ className, ...props }) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}


function CardFooter({ className, ...props }) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}


export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
