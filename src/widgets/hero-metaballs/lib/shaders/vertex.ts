/**
 * Полноэкранный треугольник без вершинного буфера: позиции считаются из gl_VertexID.
 * Треугольник, а не квад, — нет шва по диагонали и на один вызов растеризатора меньше.
 */
export const VERTEX_SHADER = /* glsl */ `#version 300 es

void main() {
  float x = float((gl_VertexID << 1) & 2);
  float y = float(gl_VertexID & 2);
  gl_Position = vec4(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
}
`;
