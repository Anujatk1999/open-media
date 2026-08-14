import { ComposerViewport, type ComposerViewportAPI } from './modules/composer/ComposerViewport';
import SceneTree from './modules/composer/SceneTree';
import Inspector from './modules/composer/Inspector';
import { useComposerStore, selectCanPose } from './stores/composerStore';
import { useEffect, useRef, useState } from 'react';
import type { SceneObject } from './stores/composerStore';
import type { CharacterType, PrimitiveType } from './stores/composerStore';

type MobileTab = 'scene' | 'viewport' | 'inspector';

function ComposerShell() {
  const objects = useComposerStore(s => s.objects);
  const selectedId = useComposerStore(s => s.selectedObjectId);
  const activeTool = useComposerStore(s => s.activeTool);
  const setActiveTool = useComposerStore(s => s.setActiveTool);
  const canPose = useComposerStore(selectCanPose);
  const addObject = useComposerStore(s => s.addObject);
  const selectObject = useComposerStore(s => s.selectObject);
  const toggleObjectVisibility = useComposerStore(s => s.toggleObjectVisibility);
  const toggleObjectLock = useComposerStore(s => s.toggleObjectLock);
  const duplicateObject = useComposerStore(s => s.duplicateObject);
  const deleteObject = useComposerStore(s => s.deleteObject);
  const renameObject = useComposerStore(s => s.renameObject);
  const updateObjectTransform = useComposerStore(s => s.updateObjectTransform);

  const viewportRef = useRef<ComposerViewportAPI>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('viewport');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const selected = objects.find(c => c.id === selectedId) ?? null;

  // Desktop layout (original)
  if (!isMobile) {
    return (
      <div className="composer-layout" style={{ gridTemplateColumns: sidebarCollapsed ? '0 minmax(0,1fr) 300px' : '232px minmax(0,1fr) 300px' }}>
        <aside className="scene-sidebar">
          <div className="sidebar-header">
            <h2>SCENE</h2>
          </div>
          <SceneTree
            objects={objects}
            selectedId={selectedId}
            onSelect={selectObject}
            onAddCharacter={(type: CharacterType) => addObject(type)}
            onAddPrimitive={(type: PrimitiveType) => addObject(type)}
            onToggleVisibility={toggleObjectVisibility}
            onToggleLock={toggleObjectLock}
            onDuplicate={duplicateObject}
            onDelete={deleteObject}
          />
        </aside>
        <button
          className="sidebar-toggle-floating"
          style={{ left: sidebarCollapsed ? 0 : 232 }}
          onClick={() => setSidebarCollapsed(v => !v)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? "▶" : "◀"}
        </button>
        <section className="composer-center">
          <ComposerViewport ref={viewportRef} />
        </section>
        <aside className="inspector">
          <h2>INSPECTOR</h2>
          <Inspector
            character={selected}
            onRename={renameObject}
            onToggleVisibility={toggleObjectVisibility}
            onToggleLock={toggleObjectLock}
            onDuplicate={duplicateObject}
            onDelete={deleteObject}
            onUpdateTransform={updateObjectTransform}
            onSetCameraView={viewportRef.current?.setCameraView}
            onResetCamera={viewportRef.current?.resetCamera}
          />
        </aside>
      </div>
    );
  }

  // Mobile layout
  return (
    <div className="composer-layout-mobile">
      {/* Viewport - always rendered but only visible when active tab */}
      <section className={`composer-center-mobile ${mobileTab === 'viewport' ? 'active' : ''}`}>
        <ComposerViewport ref={viewportRef} />
        {/* Capture Shot button - top right on mobile */}
        <button className="capture-shot-btn capture-shot-btn-mobile"
                onClick={viewportRef.current?.captureShot}
                title="Capture Shot (PNG)">
          Capture Shot
        </button>
      </section>

      {/* Scene Panel - full screen overlay */}
      <aside className={`scene-panel-mobile ${mobileTab === 'scene' ? 'active' : ''}`}>
        <div className="mobile-panel-header">
          <h2>SCENE</h2>
        </div>
        <SceneTree
          objects={objects}
          selectedId={selectedId}
          onSelect={selectObject}
          onAddCharacter={(type: CharacterType) => addObject(type)}
          onAddPrimitive={(type: PrimitiveType) => addObject(type)}
          onToggleVisibility={toggleObjectVisibility}
          onToggleLock={toggleObjectLock}
          onDuplicate={duplicateObject}
          onDelete={deleteObject}
        />
      </aside>

      {/* Inspector Panel - full screen overlay */}
      <aside className={`inspector-panel-mobile ${mobileTab === 'inspector' ? 'active' : ''}`}>
        <div className="mobile-panel-header">
          <h2>INSPECTOR</h2>
        </div>
        <Inspector
          character={selected}
          onRename={renameObject}
          onToggleVisibility={toggleObjectVisibility}
          onToggleLock={toggleObjectLock}
          onDuplicate={duplicateObject}
          onDelete={deleteObject}
          onUpdateTransform={updateObjectTransform}
          onSetCameraView={viewportRef.current?.setCameraView}
          onResetCamera={viewportRef.current?.resetCamera}
        />
      </aside>

      {/* Bottom Tab Bar */}
      <nav className="mobile-tab-bar" role="tablist" aria-label="Composer panels">
        <button
          role="tab"
          aria-selected={mobileTab === 'scene'}
          aria-controls="scene-panel"
          className={`mobile-tab ${mobileTab === 'scene' ? 'active' : ''}`}
          onClick={() => setMobileTab('scene')}
        >
          <span className="tab-icon">☰</span>
          <span className="tab-label">Scene</span>
        </button>
        <button
          role="tab"
          aria-selected={mobileTab === 'viewport'}
          aria-controls="viewport-panel"
          className={`mobile-tab ${mobileTab === 'viewport' ? 'active' : ''}`}
          onClick={() => setMobileTab('viewport')}
        >
          <span className="tab-icon">⬜</span>
          <span className="tab-label">Viewport</span>
        </button>
        <button
          role="tab"
          aria-selected={mobileTab === 'inspector'}
          aria-controls="inspector-panel"
          className={`mobile-tab ${mobileTab === 'inspector' ? 'active' : ''}`}
          onClick={() => setMobileTab('inspector')}
        >
          <span className="tab-icon">⚙</span>
          <span className="tab-label">Inspector</span>
        </button>
      </nav>

      {/* Mobile Workspace Toolbar - uses store directly */}
      <div className="mobile-toolbar-wrapper">
        <div className="mobile-toolbar">
          <div className="mobile-toolbar-tools">
            <button
              className={activeTool === 'move' ? 'on' : ''}
              title="Move (Translate)"
              onClick={() => setActiveTool('move')}
            >
              Move
            </button>
            <button
              className={activeTool === 'rotate' ? 'on' : ''}
              title="Rotate"
              onClick={() => setActiveTool('rotate')}
            >
              Rotate
            </button>
            <button
              className={activeTool === 'scale' ? 'on' : ''}
              title="Scale"
              onClick={() => setActiveTool('scale')}
            >
              Scale
            </button>
            <button
              className={activeTool === 'pose' ? 'on' : ''}
              disabled={!canPose}
              title={canPose ? 'Pose (rotate body parts)' : 'Pose applies to mannequins only'}
              onClick={() => setActiveTool('pose')}
            >
              Pose
            </button>
          </div>
          <span>Zoom <b id="mobile-zoom-display">100%</b></span>
          <button title="Zoom In" onClick={() => viewportRef.current?.zoomIn()}>+</button>
          <button title="Zoom Out" onClick={() => viewportRef.current?.zoomOut()}>-</button>
        </div>
      </div>
    </div>
  );
}

export default ComposerShell;