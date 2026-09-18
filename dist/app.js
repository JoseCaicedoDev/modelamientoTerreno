(() => {
  const data = window.TERRAIN_DATA;
  const plot = document.getElementById('terrain-plot');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const exaggeration = document.getElementById('exaggeration');
  const exaggerationValue = document.getElementById('exaggeration-value');
  const contoursButton = document.getElementById('contours-toggle');
  const resetButton = document.getElementById('reset-camera');
  const colorButtons = [...document.querySelectorAll('[data-color-mode]')];
  const touchHint = document.getElementById('touch-hint');

  const elevationScale = [
    [0.00, '#173a72'],
    [0.18, '#2488bd'],
    [0.36, '#4fbf91'],
    [0.55, '#c8d878'],
    [0.72, '#d7bb78'],
    [0.86, '#936d5b'],
    [1.00, '#f2efe6']
  ];
  const shadeScale = [[0, '#071014'], [0.28, '#33464a'], [0.58, '#83918f'], [1, '#f3f1e8']];
  const camera = { eye: { x: 1.34, y: -1.5, z: 0.78 }, center: { x: 0, y: 0, z: -0.08 } };
  let colorMode = 'elevation';
  let contoursVisible = true;

  function zAspect() {
    return 0.055 * Number(exaggeration.value);
  }

  const surface = {
    type: 'surface',
    x: data.x,
    y: data.y,
    z: data.z,
    surfacecolor: data.z,
    colorscale: elevationScale,
    cmin: data.minElevation,
    cmax: data.maxElevation,
    connectgaps: false,
    showscale: true,
    colorbar: {
      title: { text: 'Elevación<br>(m)', side: 'right', font: { color: '#dce9e6', size: 13 } },
      tickfont: { color: '#b9ceca', size: 12 },
      thickness: 14,
      len: 0.58,
      x: 0.97,
      outlinewidth: 0,
      bgcolor: 'rgba(7,21,26,0.58)'
    },
    lighting: { ambient: 0.62, diffuse: 0.76, specular: 0.12, roughness: 0.82, fresnel: 0.08 },
    lightposition: { x: -120, y: -160, z: 220 },
    contours: {
      z: {
        show: true,
        start: 0,
        end: 60,
        size: 10,
        color: 'rgba(25,20,18,0.72)',
        width: 2,
        usecolormap: false,
        highlight: false,
        project: { z: true }
      }
    },
    hovertemplate: 'Este UTM: %{x:,.1f} m<br>Norte UTM: %{y:,.1f} m<br>Elevación: %{z:.1f} m<extra></extra>'
  };

  const layout = {
    autosize: true,
    margin: { l: 0, r: 0, t: 0, b: 0 },
    paper_bgcolor: '#07151a',
    plot_bgcolor: '#07151a',
    showlegend: false,
    scene: {
      camera,
      aspectmode: 'manual',
      aspectratio: { x: 1, y: data.aspectY, z: zAspect() },
      bgcolor: '#07151a',
      xaxis: {
        title: { text: 'Este UTM (m)', font: { color: '#9fb8b4', size: 12 } },
        tickformat: ',.0f',
        tickfont: { color: '#79918e', size: 10 },
        gridcolor: 'rgba(159,184,180,0.14)', zerolinecolor: 'rgba(159,184,180,0.24)',
        backgroundcolor: '#0a1a20', showbackground: true, color: '#9fb8b4'
      },
      yaxis: {
        title: { text: 'Norte UTM (m)', font: { color: '#9fb8b4', size: 12 } },
        tickformat: ',.0f',
        tickfont: { color: '#79918e', size: 10 },
        gridcolor: 'rgba(159,184,180,0.14)', zerolinecolor: 'rgba(159,184,180,0.24)',
        backgroundcolor: '#0a1a20', showbackground: true, color: '#9fb8b4'
      },
      zaxis: {
        title: { text: 'Elevación (m)', font: { color: '#9fb8b4', size: 12 } },
        tickfont: { color: '#79918e', size: 10 },
        gridcolor: 'rgba(159,184,180,0.13)', zerolinecolor: 'rgba(159,184,180,0.24)',
        backgroundcolor: '#0a1a20', showbackground: true, color: '#9fb8b4',
        range: [data.minElevation - 2, data.maxElevation + 3]
      }
    }
  };

  const config = {
    responsive: true,
    displaylogo: false,
    scrollZoom: true,
    modeBarButtonsToRemove: ['toImage', 'sendDataToCloud', 'lasso2d', 'select2d']
  };

  function setColorMode(mode) {
    colorMode = mode;
    const elevation = mode === 'elevation';
    Plotly.restyle(plot, {
      surfacecolor: [elevation ? data.z : data.hillshade],
      colorscale: [elevation ? elevationScale : shadeScale],
      cmin: elevation ? data.minElevation : 0,
      cmax: elevation ? data.maxElevation : 255,
      'colorbar.title.text': elevation ? 'Elevación<br>(m)' : 'Relieve<br>sombreado',
      showscale: elevation
    }, [0]);
    colorButtons.forEach(button => button.classList.toggle('active', button.dataset.colorMode === mode));
  }

  function setContours(next) {
    contoursVisible = next;
    Plotly.restyle(plot, { 'contours.z.show': next, 'contours.z.project.z': next }, [0]);
    contoursButton.classList.toggle('active', next);
    contoursButton.setAttribute('aria-pressed', String(next));
  }

  if (!window.Plotly || !data) {
    loading.hidden = true;
    error.hidden = false;
    return;
  }

  Plotly.newPlot(plot, [surface], layout, config)
    .then(() => { loading.hidden = true; })
    .catch(() => { loading.hidden = true; error.hidden = false; });

  exaggeration.addEventListener('input', () => {
    exaggerationValue.value = `${exaggeration.value}×`;
    Plotly.relayout(plot, { 'scene.aspectratio.z': zAspect() });
  });

  colorButtons.forEach(button => button.addEventListener('click', () => setColorMode(button.dataset.colorMode)));
  contoursButton.addEventListener('click', () => setContours(!contoursVisible));
  resetButton.addEventListener('click', () => Plotly.relayout(plot, { 'scene.camera': camera }));
  window.addEventListener('resize', () => Plotly.Plots.resize(plot));
  window.setTimeout(() => { touchHint.style.opacity = '0'; }, 3600);
})();
