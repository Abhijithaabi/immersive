// src/trail.ts

/**
 * Creates and manages a 2D canvas to generate a mouse trail effect.
 * The canvas is intended to be used as a dynamic texture in a 3D scene.
 * This class can be instantiated to create a trail manager.
 */
export  class Trail {
  // --- Class Properties ---
  public canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private fadeAlpha:number;

  /**
   * Initializes the trail canvas.
   * @param {number} [width=512] - The width of the texture canvas.
   * @param {number} [height=512] - The height of the texture canvas.
   */
  constructor(width: number = 512, height: number = 512) {
    this.width = width;
    this.height = height;

    // Create and configure the canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Get the 2D rendering context
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error("Failed to get 2D context from canvas.");
    }
    this.ctx = context;

    // Set the initial background to black
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.fadeAlpha = 0.02;
  }

  /**
   * Updates the trail texture by fading the old trail and drawing a new point.
   * This function should be called in the main animation loop.
   * @param {object} mouse - An object with x and y properties (from 0 to 1).
   */
  public update(mouse: { x: number; y: number }): void {
    // Fade out the existing trail by drawing a semi-transparent black rectangle
    this.ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw the new white circle at the mouse position
    if(mouse && mouse.x !== undefined && mouse.y !== undefined)
    {
      const radius = this.width *0.15;
      const x = mouse.x;
      const y = mouse.y; // Invert Y-axis for canvas coordinates

      // 2. Create a radial gradient centered at the mouse position
      // The gradient goes from the center (radius 0) to the edge (radius 'radius')
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);

      // 3. Define the gradient's colors for a soft glow effect
      // It starts as semi-transparent white in the middle and fades to fully transparent.
      // Define a multi-stop gradient for an even smoother falloff.
       gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      // 0.0 -> The very center of the glow is bright.
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      // 0.4 -> 40% of the way out, the glow has faded significantly.
      gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.1)');
      // 1.0 -> At the edge, the glow is fully transparent.
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      // 4. Use the gradient as the fill style
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
  }

  /**
   * Returns the canvas element to be used as a texture.
   * @returns {HTMLCanvasElement} The canvas element.
   */
  public getTexture(): HTMLCanvasElement {
    return this.canvas;
  }
}
