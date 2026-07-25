import { useCallback, useEffect, useRef, useState } from 'react';
import { ShapeRecognitionDev } from '../modules/dev/ShapeRecognitionDev';
import { ComposerViewport, type ComposerViewportAPI } from '../modules/composer/ComposerViewport';
import { SketchboardStage } from '../modules/sketchboard/SketchboardStage';
import { useBridgeStore } from '../stores/bridgeStore';
import { useComposerStore } from '../stores/composerStore';
import SceneTree from '../modules/composer/SceneTree';
import Inspector from '../modules/composer/Inspector';
import './app.css';

export function App() {
  const [module, setModule] = useState<'composer' | 'sketchboard'>('composer');
  const image = useBridgeStore(s => s.imageDataUrl);

  if (location.pathname.includes('shape-recognition')) return <ShapeRecognitionDev/>;

  if (module === 'sketchboard') {
    return (
      <main className="app">
        <Top module={module} setModule={setModule}/>
        <section className="sketch-placeholder">
          {image ? <SketchboardStage/> : 'Capture is scheduled for a later Composer stage.'}
        </section>
      </main>
    );
  }

  return (
    <main className="app composer-shell">
      <Top module={module} setModule={setModule}/>
      <ComposerShell/>
    </main>
  );
}

function ComposerShell() {
  const characters = useComposerStore(s => s.mannequins);
  const selectedId = useComposerStore(s => s.selectedMannequinId);
  const addMannequin = useComposerStore(s => s.addMannequin);
  const selectMannequin = useComposerStore(s => s.selectMannequin);
  const toggleMannequinVisibility = useComposerStore(s => s.toggleMannequinVisibility);
  const toggleMannequinLock = useComposerStore(s => s.toggleMannequinLock);
  const duplicateMannequin = useComposerStore(s => s.duplicateMannequin);
  const deleteMannequin = useComposerStore(s => s.deleteMannequin);
  const renameMannequin = useComposerStore(s => s.renameMannequin);
  const updateMannequinTransform = useComposerStore(s => s.updateMannequinTransform);

  const viewportRef = useRef<ComposerViewportAPI>(null);
  const [jointValues, setJointValues] = useState<Record<string, number>>({});

  const handleJointChange = useCallback((configKey: string, dofIndex: number, value: number) => {
    if (!selectedId || !viewportRef.current) return;
    viewportRef.current.setJoint(selectedId, configKey, dofIndex, value);
    const key = `${configKey}:${dofIndex}`;
    setJointValues(prev => ({ ...prev, [key]: value }));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !viewportRef.current) {
      setJointValues({});
      return;
    }
    const vals = viewportRef.current.getJointValues(selectedId);
    setJointValues(vals);
  }, [selectedId]);

  const selected = characters.find(c => c.id === selectedId) ?? null;

  return (
    <div className="composer-layout">
      <aside className="scene-sidebar">
        <h2>SCENE</h2>
        <SceneTree
          characters={characters}
          selectedId={selectedId}
          onSelect={selectMannequin}
          onAddCharacter={addMannequin}
          onToggleVisibility={toggleMannequinVisibility}
          onToggleLock={toggleMannequinLock}
          onDuplicate={duplicateMannequin}
          onDelete={deleteMannequin}
        />
      </aside>
      <section className="composer-center">
        <ComposerViewport ref={viewportRef} />
      </section>
      <aside className="inspector">
        <h2>INSPECTOR</h2>
        <Inspector
          character={selected}
          onRename={renameMannequin}
          onToggleVisibility={toggleMannequinVisibility}
          onToggleLock={toggleMannequinLock}
          onDuplicate={duplicateMannequin}
          onDelete={deleteMannequin}
          onUpdateTransform={updateMannequinTransform}
          jointValues={jointValues}
          onJointChange={handleJointChange}
        />
      </aside>
    </div>
  );
}

function Top({module, setModule}: {module:'composer'|'sketchboard'; setModule:(m:'composer'|'sketchboard')=>void}) {
  return (
    <header className="topbar">
      <span className="logo">SPATIAL<span>SKETCH</span></span>
      <nav>
        <button className={module==='composer'?'active':''} onClick={()=>setModule('composer')}>Composer</button>
        <button className={module==='sketchboard'?'active':''} onClick={()=>setModule('sketchboard')}>Sketchboard</button>
      </nav>
      <div className="top-actions">
        <button disabled title="History arrives in a later stage">Undo</button>
        <button disabled title="History arrives in a later stage">Redo</button>
        <button disabled title="Capture arrives in a later Composer stage">Capture · later</button>
      </div>
    </header>
  );
}
