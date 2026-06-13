import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowUp } from "lucide-react";
import Image from "next/image";
import Logo from "@/components/logo";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F6F6F6] scroll-smooth">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <Logo />

        <div className="flex items-center space-x-3">
          <a
            href="/app"
            className="flex item-center justify-center text-white rounded-[20px] p-px h-11 hover:opacity-90 transition-opacity duration-300 ease-in-out"
            style={{
              background: "linear-gradient(8deg, #B776F1, #000000 69%);",
            }}
          >
            <Button className="bg-white w-full h-full px-6 rounded-[20px] text-black hover:bg-white hover:opacity-90">
              Launch app
            </Button>
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-medium leading-none text-gray-900 mb-4 text-balance">
          You live it.
        </h1>
        <h2 className="text-4xl md:text-6xl font-medium leading-none mb-6 text-balance">
          <span
            className="bg-clip-text text-transparent italic"
            style={{
              backgroundImage:
                "linear-gradient(to right, #000000, #B776F1 67%)",
            }}
          >
            cortex
          </span>{" "}
          remembers it.
        </h2>
        <p className="text-lg text-black/75 mb-12 md:mb-24 max-w-2xl mx-auto text-pretty">
          A calm, private home for everything worth remembering, your notes,
          files and thoughts, quietly made sense of over time.
        </p>

        {/* Input Section */}
        <div className="max-w-2xl mx-auto relative">
          <Input
            placeholder="What's on your mind?"
            className="w-full h-36 text-lg px-6 pr-16 border-2 border-gray-200 rounded-3xl focus:border-purple-600 focus:ring-purple-600"
          />
          <a
            href="/app"
            aria-label="Open Cortex"
            className="absolute right-8 bottom-4 h-12 w-12 bg-[#EBF0F2] hover:bg-gray-200 text-gray-600 rounded-full inline-flex items-center justify-center transition-colors"
          >
            <ArrowUp className="h-5 w-5" />
          </a>
        </div>
      </main>

      {/* How it Works Section */}
      <section className="bg-transparent text-white py-20 relative">
        <Image
          src="/mesh-bg.png"
          alt=""
          layout="fill"
          objectFit="cover"
          className="absolute inset-0 z-0"
        />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <h3 className="text-4xl font-bold mb-4 md:mb-8">How it works</h3>
          <p className="text-sm md:text-xl mb-12 md:mb-28 max-w-3xl mx-auto text-pretty">
            Tell Cortex anything worth keeping, a thought, a moment, a file. It
            holds it safely, connects what belongs together, and gently surfaces
            what matters when you look back.
          </p>

          <Image
            src="/cortex-app.png"
            alt=""
            height={557}
            width={857}
            objectFit="cover"
            className="mx-auto"
          />

          {/* Mockup */}
          {/* <div className="bg-white rounded-2xl p-8 max-w-2xl mx-auto">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
            </div>
            <div className="text-left">
              <h4 className="text-gray-900 font-semibold mb-4">
                What do you need?
              </h4>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-gray-600 text-sm">Request a prompt</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  Gen
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  Coding
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  Creative
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  LinkedIn
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  Brainstorm
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  Work
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-sm mt-2">
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  Business
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  Social
                </span>
              </div>
            </div>
          </div> */}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6">
          <h3 className="text-4xl font-bold text-center mb-12 text-gray-900">
            Frequently asked questions
          </h3>
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="bg-white rounded-lg px-6">
              <AccordionTrigger className="text-left font-semibold text-gray-900 hover:no-underline">
                What is Cortex?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Cortex is a calm, private place for everything worth
                remembering. Keep notes, files and thoughts, and Cortex quietly
                makes sense of them, tidying repeats, surfacing patterns, and
                answering questions grounded only in what you've actually saved.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="bg-white rounded-lg px-6">
              <AccordionTrigger className="text-left font-semibold text-gray-900 hover:no-underline">
                Is my memory private?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Yes, completely. Your memory is yours alone. Cortex is
                local-first, so what you keep stays with you. Nothing is ever
                deleted behind your back; things you move past are gently set
                aside, never lost.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="bg-white rounded-lg px-6">
              <AccordionTrigger className="text-left font-semibold text-gray-900 hover:no-underline">
                What can I keep in it?
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                Anything worth holding onto, a half-formed thought, a habit, a
                person, a trip, a document. Cortex reads what you give it,
                remembers what matters, and lets you look back whenever you need
                to.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white pt-8 md:pt-16 pb-[130px] md:pb-[300px] rounded-t-4xl relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start">
            <div className="mb-8 md:mb-0">
              <div className="flex items-center space-x-3.5 mb-4">
                <Logo variant="white" />
                <span className="text-3xl font-medium">Cortex</span>
              </div>
            </div>
            <div className="max-w-md">
              <p className="text-gray-300 text-sm leading-relaxed">
                We carry more than we can hold in mind.
                <br />
                <br />
                Cortex remembers it for you, gently, and only for you.
              </p>
            </div>
          </div>

          {/* Large Cortex Text */}
          <div className="mt-16 text-center absolute left-1/2 -translate-x-1/2">
            <h2 className="text-8xl md:text-[350px] font-bold text-[#4C4C4C]/40 select-none">
              Cortex
            </h2>
          </div>
        </div>
      </footer>
    </div>
  );
}
