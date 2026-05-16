'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowRight, Link as LinkIcon, Zap } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from '@hack/ui';

export interface OrbitalTimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  status: 'completed' | 'in-progress' | 'pending';
  energy: number;
}

interface Props {
  timelineData: OrbitalTimelineItem[];
  /** Tailwind className for the outer wrapper. Useful to pin a min-height. */
  className?: string;
  /** Pixel radius of the orbit. Smaller values pack nodes tighter. Default 200. */
  radius?: number;
}

function getStatusStyles(status: OrbitalTimelineItem['status']): string {
  switch (status) {
    case 'completed':
      return 'text-white bg-success/30 border-success/50';
    case 'in-progress':
      return 'text-black bg-white border-white';
    case 'pending':
      return 'text-white bg-black/40 border-white/50';
    default:
      return 'text-white bg-black/40 border-white/50';
  }
}

function statusLabel(status: OrbitalTimelineItem['status']): string {
  if (status === 'completed') return 'COMPLETO';
  if (status === 'in-progress') return 'EN PROGRESO';
  return 'PENDIENTE';
}

export function RadialOrbitalTimeline({ timelineData, className, radius = 200 }: Props) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleContainerClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const getRelatedItems = (itemId: number): number[] => {
    const item = timelineData.find((i) => i.id === itemId);
    return item ? item.relatedIds : [];
  };

  const centerViewOnNode = (nodeId: number) => {
    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    if (nodeIndex < 0) return;
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;
    setRotationAngle(270 - targetAngle);
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const isAlreadyOpen = Boolean(prev[id]);
      const newState: Record<number, boolean> = {};
      newState[id] = !isAlreadyOpen;

      if (!isAlreadyOpen) {
        setActiveNodeId(id);
        setAutoRotate(false);
        const relatedItems = getRelatedItems(id);
        const newPulseEffect: Record<number, boolean> = {};
        relatedItems.forEach((relId) => {
          newPulseEffect[relId] = true;
        });
        setPulseEffect(newPulseEffect);
        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }

      return newState;
    });
  };

  useEffect(() => {
    if (!autoRotate) return;
    const id = window.setInterval(() => {
      setRotationAngle((prev) => Number(((prev + 0.3) % 360).toFixed(3)));
    }, 50);
    return () => window.clearInterval(id);
  }, [autoRotate]);

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radian = (angle * Math.PI) / 180;
    const x = radius * Math.cos(radian);
    const y = radius * Math.sin(radian);
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2)));
    return { x, y, zIndex, opacity };
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (activeNodeId === null) return false;
    return getRelatedItems(activeNodeId).includes(itemId);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className={cn(
        'relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-border-subtle bg-black',
        className,
      )}
    >
      <div
        ref={orbitRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: '1000px' }}
      >
        {/* Center pulsing orb */}
        <div className="absolute z-10 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 via-brand-700 to-purple-700 animate-pulse">
          <div className="absolute h-20 w-20 rounded-full border border-white/20 animate-ping opacity-70" />
          <div
            className="absolute h-24 w-24 rounded-full border border-white/10 animate-ping opacity-50"
            style={{ animationDelay: '0.5s' }}
          />
          <div className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-md" />
        </div>

        {/* Orbit ring */}
        <div
          className="absolute rounded-full border border-white/10"
          style={{ width: `${radius * 2}px`, height: `${radius * 2}px` }}
        />

        {timelineData.map((item, index) => {
          const position = calculateNodePosition(index, timelineData.length);
          const isExpanded = Boolean(expandedItems[item.id]);
          const isRelated = isRelatedToActive(item.id);
          const isPulsing = Boolean(pulseEffect[item.id]);
          const Icon = item.icon;

          const nodeStyle = {
            transform: `translate(${position.x}px, ${position.y}px)`,
            zIndex: isExpanded ? 200 : position.zIndex,
            opacity: isExpanded ? 1 : position.opacity,
          };

          return (
            <div
              key={item.id}
              ref={(el) => {
                nodeRefs.current[item.id] = el;
              }}
              className="absolute cursor-pointer transition-all duration-700"
              style={nodeStyle}
              onClick={(e) => {
                e.stopPropagation();
                toggleItem(item.id);
              }}
            >
              {/* Energy halo */}
              <div
                className={cn(
                  'absolute -inset-1 rounded-full',
                  isPulsing && 'animate-pulse duration-1000',
                )}
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)',
                  width: `${item.energy * 0.5 + 40}px`,
                  height: `${item.energy * 0.5 + 40}px`,
                  left: `-${(item.energy * 0.5) / 2}px`,
                  top: `-${(item.energy * 0.5) / 2}px`,
                }}
              />

              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2',
                  'transition-all duration-300',
                  isExpanded
                    ? 'scale-150 border-white bg-white text-black shadow-lg shadow-white/30'
                    : isRelated
                      ? 'animate-pulse border-white bg-white/50 text-black'
                      : 'border-white/40 bg-black text-white',
                )}
              >
                <Icon size={16} />
              </div>

              <div
                className={cn(
                  'absolute top-12 whitespace-nowrap text-xs font-semibold tracking-wider transition-all duration-300',
                  isExpanded ? 'scale-125 text-white' : 'text-white/70',
                )}
              >
                {item.title}
              </div>

              {isExpanded && (
                <Card className="absolute left-1/2 top-20 w-72 -translate-x-1/2 overflow-visible border-white/30 bg-black/90 shadow-xl shadow-white/10 backdrop-blur-lg">
                  <div className="absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-white/50" />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className={cn('px-2 text-2xs', getStatusStyles(item.status))}>
                        {statusLabel(item.status)}
                      </Badge>
                      <span className="font-mono text-2xs text-white/50">{item.date}</span>
                    </div>
                    <CardTitle className="mt-2 text-sm text-white">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-white/80">
                    <p className="leading-relaxed">{item.content}</p>

                    <div className="mt-4 border-t border-white/10 pt-3">
                      <div className="mb-1 flex items-center justify-between text-2xs">
                        <span className="flex items-center text-white/70">
                          <Zap size={10} className="mr-1" />
                          Avance
                        </span>
                        <span className="font-mono">{item.energy}%</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-brand-500 to-purple-500"
                          style={{ width: `${item.energy}%` }}
                        />
                      </div>
                    </div>

                    {item.relatedIds.length > 0 && (
                      <div className="mt-4 border-t border-white/10 pt-3">
                        <div className="mb-2 flex items-center">
                          <LinkIcon size={10} className="mr-1 text-white/70" />
                          <h4 className="text-2xs font-medium uppercase tracking-wider text-white/70">
                            Conectado con
                          </h4>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.relatedIds.map((relatedId) => {
                            const relatedItem = timelineData.find((i) => i.id === relatedId);
                            if (!relatedItem) return null;
                            return (
                              <Button
                                key={relatedId}
                                variant="outline"
                                size="xs"
                                className="border-white/20 bg-transparent text-white/80 hover:bg-white/10 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleItem(relatedId);
                                }}
                              >
                                {relatedItem.title}
                                <ArrowRight size={8} className="ml-1 text-white/60" />
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
