import React from 'react';
import { Icon, clsx } from '../components.jsx';

const MAX_FOTOS = 4;

export function FotosUploader({ fotos, onChange }) {
  const inputRef = React.useRef(null);
  const cameraInputRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);

  const processFiles = (files) => {
    const validas = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_FOTOS - fotos.length);
    if (!validas.length) return;

    validas.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        onChange([...fotos, { id: `new_${Date.now()}_${Math.random()}`, file, preview: e.target.result }].slice(0, MAX_FOTOS));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleInput = (e) => { processFiles(e.target.files); e.target.value = ""; };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const remove = (id) => onChange(fotos.filter((f) => f.id !== id));

  return (
    <div className="fotos-uploader">
      <div className="fotos-grid">
        {fotos.map((f) => (
          <div key={f.id} className="foto-thumb">
            <img src={f.preview || f.url} alt={f.nombre || "foto"} />
            <button className="foto-remove" onClick={() => remove(f.id)}>
              <Icon name="x" size={12} />
            </button>
          </div>
        ))}

        {fotos.length < MAX_FOTOS && (
          <button
            className={clsx("foto-add", dragging && "drag-over")}
            onClick={() => cameraInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            title="Tomar foto"
          >
            <Icon name="camera" size={20} />
            <span>{fotos.length === 0 ? "Tomar foto" : `${MAX_FOTOS - fotos.length} más`}</span>
          </button>
        )}
        {fotos.length < MAX_FOTOS && (
          <button
            className="foto-add"
            onClick={() => inputRef.current?.click()}
            title="Elegir de la galería"
          >
            <Icon name="plus" size={20} />
            <span>Galería</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef} type="file" accept="image/*" multiple hidden
        onChange={handleInput}
      />
      <input
        ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden
        onChange={handleInput}
      />

      {fotos.length > 0 && (
        <div className="fotos-count">
          {fotos.length}/{MAX_FOTOS} fotos · {fotos.filter(f => f.file).length} pendiente{fotos.filter(f => f.file).length !== 1 ? "s" : ""} de subir
        </div>
      )}
    </div>
  );
}
