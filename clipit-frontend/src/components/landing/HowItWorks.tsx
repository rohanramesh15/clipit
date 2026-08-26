import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { loopStages } from '../../data/landing';
import { motionTiming } from '../../lib/motion';
import watchImage from '../../assets/watch.png';
import captureImage from '../../assets/capture.png';
import practiceImage from '../../assets/practice.png';

const visuals = [watchImage, captureImage, practiceImage];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-blush py-16 md:py-24" aria-labelledby="how-it-works-title">
      <div className="mx-auto max-w-page px-5 sm:px-8">
        <div className="max-w-2xl">
          <h2 id="how-it-works-title" className="font-heading text-section font-medium text-primary md:text-section-lg md:font-medium">
            One loop, from watching to remembering
          </h2>
        </div>

        <motion.ol
          className="mt-8 grid gap-6 md:grid-cols-3 md:gap-x-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {loopStages.map((stage, index) => {
            const visual = visuals[index];
            return (
              <motion.li
                key={stage.step}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0, transition: motionTiming.base },
                }}
                className="relative flex flex-col rounded-2xl bg-app p-5"
              >
                <div className="h-44 overflow-hidden rounded-xl border border-subtle">
                  <img src={visual} alt="" className="h-full w-full object-cover" />
                </div>

                <h3 className="mt-4 font-heading text-card-title font-medium text-primary">{stage.title}</h3>
                <p className="mt-2 text-body text-secondary">{stage.description}</p>

                {index < loopStages.length - 1 && (
                  <span
                    className="pointer-events-none absolute left-1/2 top-full z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-accent md:left-auto md:right-[-46px] md:top-1/2 md:translate-x-0 md:-translate-y-1/2"
                    aria-hidden="true"
                  >
                    <ChevronRight className="h-6 w-6 rotate-90 md:rotate-0" strokeWidth={2.5} />
                  </span>
                )}
              </motion.li>
            );
          })}
        </motion.ol>
      </div>
    </section>
  );
}
