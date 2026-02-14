import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="pt-6 text-center">
          <div className="mb-4 flex justify-center">
            <AlertTriangle className="h-16 w-16 text-red-500" />
          </div>
          <h1 className="text-4xl font-display font-bold text-gray-900 mb-2">404</h1>
          <p className="text-gray-500 mb-6 font-medium">
            Oops! This carrot patch doesn't exist.
          </p>

          <Link href="/">
            <Button className="w-full font-display text-xl h-12 bg-primary hover:bg-orange-600">
              Return Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
