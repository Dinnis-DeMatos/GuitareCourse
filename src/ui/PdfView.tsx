import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Une tablature PDF dessinée page par page, à la largeur de la scène : rien que la partition, sans
 * la barre d'outils qu'ajoute la visionneuse du navigateur.
 */
export function PdfView({ url, title }: { url: string; title: string }) {
  const pagesRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const container = pagesRef.current
    if (!container) return
    const task = getDocument({ url })
    let cancelled = false
    task.promise
      .then(async (pdf) => {
        // Netteté sur les écrans haute densité : on dessine plus grand que l'affichage.
        const width = container.clientWidth * window.devicePixelRatio
        for (let number = 1; number <= pdf.numPages && !cancelled; number++) {
          const page = await pdf.getPage(number)
          if (cancelled) return
          const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          container.append(canvas)
          await page.render({ canvas, viewport }).promise
        }
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      void task.destroy()
      container.replaceChildren()
    }
  }, [url])

  return (
    <div className="pdf" role="document" aria-label={title}>
      {failed ? (
        <p className="stage-error" role="alert">
          Cette tablature ne peut pas être affichée.
          <span>Le fichier est peut-être absent ou abîmé.</span>
        </p>
      ) : (
        <div ref={pagesRef} className="pdf-pages" />
      )}
    </div>
  )
}
