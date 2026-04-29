document.addEventListener('DOMContentLoaded', () => {
    // Configurar PDF.js Worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // ----------------------------------------------------
    // Lógica de Pestañas (Tabs)
    // ----------------------------------------------------
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover 'active' de todos
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Añadir 'active' al seleccionado
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // ----------------------------------------------------
    // Estado de la Aplicación
    // ----------------------------------------------------
    let state = {
        imgFiles: [],
        pdfFiles: [],
        pdf2JpgFiles: [],
        editPdfFile: null,
        fabricCanvas: null,
        originalPdfBytes: null
    };

    // ----------------------------------------------------
    // Elementos del DOM
    // ----------------------------------------------------
    // Imágenes a PDF
    const dropzoneImg = document.getElementById('dropzone-img');
    const fileInputImg = document.getElementById('file-img');
    const fileListImg = document.getElementById('file-list-img');
    const btnConvertImg = document.getElementById('btn-convert-img');

    // Unir PDFs
    const dropzonePdf = document.getElementById('dropzone-pdf');
    const fileInputPdf = document.getElementById('file-pdf');
    const fileListPdf = document.getElementById('file-list-pdf');
    const btnMergePdf = document.getElementById('btn-merge-pdf');

    // PDF a JPG
    const dropzonePdf2Jpg = document.getElementById('dropzone-pdf2jpg');
    const fileInputPdf2Jpg = document.getElementById('file-pdf2jpg');
    const fileListPdf2Jpg = document.getElementById('file-list-pdf2jpg');
    const btnConvertPdf2Jpg = document.getElementById('btn-convert-pdf2jpg');

    // Notificaciones Toast
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    let toastTimeout;

    // ----------------------------------------------------
    // Funciones de Utilidad
    // ----------------------------------------------------
    function showToast(message, isError = false) {
        toastMsg.textContent = message;
        if (isError) {
            toast.classList.add('error');
            toast.querySelector('i').className = 'fa-solid fa-circle-exclamation';
        } else {
            toast.classList.remove('error');
            toast.querySelector('i').className = 'fa-solid fa-circle-check';
        }
        
        toast.classList.remove('hidden');
        
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3500);
    }

    // Normalizar cualquier formato de imagen usando Canvas
    // Esto asegura que `jsPDF` pueda renderizar casi cualquier imagen que el navegador pueda interpretar (WEBP, GIF, BMP, etc)
    function processImageForPdf(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                
                // Si la imagen conserva transparencia y es PNG, la exportaremos a PNG
                const isPngAndTransparent = file.type === 'image/png';
                const format = isPngAndTransparent ? 'PNG' : 'JPEG';
                const mimeType = isPngAndTransparent ? 'image/png' : 'image/jpeg';
                
                // Fondo blanco para imágenes que tienen transparencia pero no las queremos guardar como PNG
                if (!isPngAndTransparent) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL(mimeType, 0.95);
                
                URL.revokeObjectURL(url);
                resolve({ 
                    width: img.width, 
                    height: img.height, 
                    dataUrl: dataUrl, 
                    format: format 
                });
            };
            
            img.onerror = () => {
                console.error("Error cargando la imagen:", file.name);
                URL.revokeObjectURL(url);
                reject(new Error("Error al cargar la imagen " + file.name));
            };
            
            img.src = url;
        });
    }

    // Configurar el sistema de Drag & Drop y selección manual
    function setupFileUploader(dropzone, input, listType, listElement, actionBtn, acceptedTypes, minRequired) {
        
        // Manejadores de Drag & Drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });

        // Selección manual
        input.addEventListener('change', (e) => {
            handleFiles(e.target.files);
            input.value = ''; // Reset para poder seleccionar el mismo archivo de nuevo si se borró
        });

        function handleFiles(files) {
            const fileArray = Array.from(files);
            
            // Validar tipos
            const validFiles = fileArray.filter(file => {
                if (acceptedTypes.includes('image/*')) return file.type.startsWith('image/');
                return acceptedTypes.includes(file.type);
            });

            if (validFiles.length !== files.length) {
                showToast('Algunos archivos no tienen un formato válido', true);
            }

            // Añadir al estado
            state[listType] = [...state[listType], ...validFiles];
            renderList();
        }

        // Renderizado visual de la lista
        function renderList() {
            listElement.innerHTML = '';
            
            state[listType].forEach((file, index) => {
                const item = document.createElement('div');
                item.className = 'file-item';
                // Añadir un pequeño retraso de animación en base al index si se añaden varios
                item.style.animationDelay = `${index * 0.05}s`;
                
                const icon = (listType === 'pdfFiles' || listType === 'pdf2JpgFiles') ? 'fa-file-pdf' : 'fa-image';
                
                item.innerHTML = `
                    <span class="name"><i class="fa-regular ${icon}"></i> ${file.name}</span>
                    <i class="fa-solid fa-trash remove" data-index="${index}"></i>
                `;
                listElement.appendChild(item);
            });

            // Actualizar el estado del botón principal
            actionBtn.disabled = state[listType].length < minRequired;

            // Escuchar clics en botones de remover
            listElement.querySelectorAll('.remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = e.target.dataset.index;
                    state[listType].splice(idx, 1);
                    renderList();
                });
            });
        }
        
        return renderList;
    }

    // Inicializar los uploaders
    const renderImgList = setupFileUploader(
        dropzoneImg, fileInputImg, 'imgFiles', fileListImg, btnConvertImg, ['image/*'], 1
    );
    
    const renderPdfList = setupFileUploader(
        dropzonePdf, fileInputPdf, 'pdfFiles', fileListPdf, btnMergePdf, ['application/pdf'], 2
    );

    const renderPdf2JpgList = setupFileUploader(
        dropzonePdf2Jpg, fileInputPdf2Jpg, 'pdf2JpgFiles', fileListPdf2Jpg, btnConvertPdf2Jpg, ['application/pdf'], 1
    );

    // ----------------------------------------------------
    // Acción: Convertir Imágenes a PDF
    // ----------------------------------------------------
    btnConvertImg.addEventListener('click', async () => {
        if (state.imgFiles.length === 0) return;

        try {
            // Estado visual de procesamiento
            btnConvertImg.disabled = true;
            btnConvertImg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Procesando...';

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();
            
            for (let i = 0; i < state.imgFiles.length; i++) {
                const file = state.imgFiles[i];
                if (i > 0) pdf.addPage();
                
                // Normalizamos la imagen, no importando su formato de origen
                const processedImg = await processImageForPdf(file);
                
                // Cálculos para centrar y escalar la imagen conservando proporciones
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                
                const ratio = Math.min(pdfWidth / processedImg.width, pdfHeight / processedImg.height);
                const width = processedImg.width * ratio;
                const height = processedImg.height * ratio;
                
                const x = (pdfWidth - width) / 2;
                const y = (pdfHeight - height) / 2;
                
                // Añadir imagen al canvas de jsPDF
                pdf.addImage(processedImg.dataUrl, processedImg.format, x, y, width, height);
            }
            
            pdf.save("imagenes_convertidas.pdf");
            
            // Limpieza
            state.imgFiles = [];
            renderImgList();
            showToast('PDF generado correctamente');
            
        } catch (error) {
            console.error(error);
            showToast('Ocurrió un error al procesar las imágenes', true);
        } finally {
            // Restaurar botón
            btnConvertImg.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Convertir a PDF';
            btnConvertImg.disabled = state.imgFiles.length < 1;
        }
    });

    // ----------------------------------------------------
    // Acción: Unir Archivos PDF
    // ----------------------------------------------------
    btnMergePdf.addEventListener('click', async () => {
        if (state.pdfFiles.length < 2) return;

        try {
            // Estado visual de procesamiento
            btnMergePdf.disabled = true;
            btnMergePdf.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Uniéndolos...';

            const { PDFDocument } = window.PDFLib;
            const mergedPdf = await PDFDocument.create();

            for (const file of state.pdfFiles) {
                // Leer archivo como buffer
                const arrayBuffer = await file.arrayBuffer();
                // Cargar documento PDF
                const pdf = await PDFDocument.load(arrayBuffer);
                // Copiar todas las páginas al nuevo documento
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            // Guardar documento final
            const mergedPdfFile = await mergedPdf.save();
            
            // Descargar el documento creado
            const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "pdfs_unidos.pdf";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Limpieza
            state.pdfFiles = [];
            renderPdfList();
            showToast('PDFs combinados correctamente');
            
        } catch (error) {
            console.error(error);
            showToast('Error al unir. Algunos PDFs podrían estar protegidos.', true);
        } finally {
            // Restaurar botón
            btnMergePdf.innerHTML = '<i class="fa-solid fa-link"></i> Unir PDFs';
            btnMergePdf.disabled = state.pdfFiles.length < 2;
        }
    });

    // ----------------------------------------------------
    // Acción: Convertir PDF a JPG
    // ----------------------------------------------------
    btnConvertPdf2Jpg.addEventListener('click', async () => {
        if (state.pdf2JpgFiles.length === 0) return;

        const file = state.pdf2JpgFiles[0]; // Solo procesamos el primero por simplicidad en la UI
        
        try {
            btnConvertPdf2Jpg.disabled = true;
            btnConvertPdf2Jpg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Convirtiendo...';

            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            const numPages = pdf.numPages;
            
            const zip = new JSZip();
            const folderName = file.name.replace('.pdf', '') + "_imagenes";
            const imgFolder = zip.folder(folderName);

            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                
                // Escalar para buena calidad
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                // Obtener base64 del JPG
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const base64Data = imgData.split(',')[1];
                
                imgFolder.file(`pagina_${i}.jpg`, base64Data, { base64: true });
                
                // Actualizar texto del botón para mostrar progreso si hay muchas páginas
                if (numPages > 5) {
                    btnConvertPdf2Jpg.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${Math.round((i/numPages)*100)}%`;
                }
            }

            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${folderName}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            state.pdf2JpgFiles = [];
            renderPdf2JpgList();
            showToast('PDF convertido a serie de JPGs con éxito');

        } catch (error) {
            console.error(error);
            showToast('Error al convertir el PDF', true);
        } finally {
            btnConvertPdf2Jpg.innerHTML = '<i class="fa-solid fa-image"></i> Convertir a JPG';
            btnConvertPdf2Jpg.disabled = state.pdf2JpgFiles.length < 1;
        }
    });
    
    // ----------------------------------------------------
    // Acción: Editor de PDF Interactivo
    // ----------------------------------------------------
    const fileInputEdit = document.getElementById('file-edit');
    const dropzoneEdit = document.getElementById('dropzone-edit');
    const toolbarEdit = document.getElementById('pdf-toolbar');
    const wrapperEdit = document.getElementById('canvas-wrapper');
    const btnSaveEdit = document.getElementById('btn-save-edit');

    // Inicializar Uploader para Editor
    setupFileUploader(dropzoneEdit, fileInputEdit, 'editPdfFile', null, { disabled: false }, ['application/pdf'], 1);

    // Sobrescribir el render para disparar la carga del PDF
    const originalRender = setupFileUploader(dropzoneEdit, fileInputEdit, 'editPdfFile', { innerHTML:'' }, { disabled: false }, ['application/pdf'], 1);
    
    fileInputEdit.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            loadPdfForEditing(file);
        }
    });

    async function loadPdfForEditing(file) {
        try {
            showToast('Cargando documento...');
            state.originalPdfBytes = await file.arrayBuffer();
            
            const loadingTask = pdfjsLib.getDocument({ data: state.originalPdfBytes });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            
            const viewport = page.getViewport({ scale: 1.5 });
            
            // Usar un canvas oculto para renderizar el PDF original
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.height = viewport.height;
            tempCanvas.width = viewport.width;

            await page.render({ canvasContext: tempCtx, viewport: viewport }).promise;

            // Mostrar el editor UI
            dropzoneEdit.classList.add('hidden');
            toolbarEdit.classList.remove('hidden');
            wrapperEdit.classList.remove('hidden');

            // Inicializar Fabric.js con las dimensiones exactas
            if (state.fabricCanvas) {
                state.fabricCanvas.dispose();
            }
            
            state.fabricCanvas = new fabric.Canvas('pdf-canvas', {
                width: viewport.width,
                height: viewport.height,
                isDrawingMode: false
            });

            // Poner el PDF renderizado como fondo
            const bgData = tempCanvas.toDataURL('image/png');
            fabric.Image.fromURL(bgData, (img) => {
                state.fabricCanvas.setBackgroundImage(img, state.fabricCanvas.renderAll.bind(state.fabricCanvas));
            });

        } catch (error) {
            console.error("Error al cargar PDF en editor:", error);
            showToast('Error al cargar PDF', true);
        }
    }

    // Herramientas del Toolbar Mejoradas
    const toolBtns = document.querySelectorAll('.tool-btn');
    const imgUpload = document.getElementById('img-upload');

    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!state.fabricCanvas) return;
            
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tool = btn.id;
            state.fabricCanvas.isDrawingMode = false;
            
            if (tool === 'tool-move') {
                state.fabricCanvas.selection = true;
                state.fabricCanvas.forEachObject(o => o.selectable = o.evented = true);
            } else if (tool === 'tool-text') {
                const text = new fabric.IText('Escribe algo...', {
                    left: 100,
                    top: 100,
                    fontFamily: 'Outfit',
                    fontSize: 24,
                    fill: '#000000'
                });
                state.fabricCanvas.add(text);
                state.fabricCanvas.setActiveObject(text);
            } else if (tool === 'tool-draw') {
                state.fabricCanvas.isDrawingMode = true;
                state.fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(state.fabricCanvas);
                state.fabricCanvas.freeDrawingBrush.width = 3;
                state.fabricCanvas.freeDrawingBrush.color = '#000000';
            } else if (tool === 'tool-highlighter') {
                state.fabricCanvas.isDrawingMode = true;
                state.fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(state.fabricCanvas);
                state.fabricCanvas.freeDrawingBrush.width = 20;
                state.fabricCanvas.freeDrawingBrush.color = 'rgba(255, 255, 0, 0.4)'; // Amarillo transparente
            } else if (tool === 'tool-rect') {
                const rect = new fabric.Rect({
                    left: 150, top: 150, width: 100, height: 100,
                    fill: 'transparent', stroke: '#000000', strokeWidth: 2
                });
                state.fabricCanvas.add(rect);
            } else if (tool === 'tool-image') {
                imgUpload.click();
            } else if (tool === 'tool-x') {
                const xText = new fabric.Text('✖', {
                    left: 200, top: 200, fontSize: 40, fill: '#ff0000', fontWeight: 'bold'
                });
                state.fabricCanvas.add(xText);
            } else if (tool === 'tool-erase') {
                const active = state.fabricCanvas.getActiveObject();
                if (active) state.fabricCanvas.remove(active);
            } else if (tool === 'tool-undo') {
                const objs = state.fabricCanvas.getObjects();
                if (objs.length > 0) state.fabricCanvas.remove(objs[objs.length - 1]);
            }
        });
    });

    // Manejador de subida de imagen para el editor
    imgUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (f) => {
            const data = f.target.result;
            fabric.Image.fromURL(data, (img) => {
                img.scaleToWidth(200);
                state.fabricCanvas.add(img);
                state.fabricCanvas.centerObject(img);
                state.fabricCanvas.setActiveObject(img);
            });
        };
        reader.readAsDataURL(file);
    });

    // Guardar Edición
    btnSaveEdit.addEventListener('click', async () => {
        if (!state.fabricCanvas) return;
        
        try {
            btnSaveEdit.disabled = true;
            btnSaveEdit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';

            // Exportar canvas de fabric como imagen de alta resolución
            const dataURL = state.fabricCanvas.toDataURL({
                format: 'png',
                quality: 1
            });

            // Usar pdf-lib para incrustar esta imagen sobre la original
            const { PDFDocument } = window.PDFLib;
            const pdfDoc = await PDFDocument.load(state.originalPdfBytes);
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];

            const editImg = await pdfDoc.embedPng(dataURL);
            const { width, height } = firstPage.getSize();
            
            firstPage.drawImage(editImg, {
                x: 0,
                y: 0,
                width: width,
                height: height
            });

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "pdf_editado.pdf";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            showToast('PDF editado guardado con éxito');
            
            // Reset UI
            toolbarEdit.classList.add('hidden');
            wrapperEdit.classList.add('hidden');
            dropzoneEdit.classList.remove('hidden');

        } catch (error) {
            console.error("Error al guardar edición:", error);
            showToast('Error al guardar edición', true);
        } finally {
            btnSaveEdit.disabled = false;
            btnSaveEdit.innerHTML = '<i class="fa-solid fa-check"></i> LISTO';
        }
    });

});
