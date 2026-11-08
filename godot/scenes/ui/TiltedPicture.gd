class_name TiltedPicture
## A picture drawn on a surface turned in 3D (the logo, the deck boxes). One quad of two triangles maps a picture flat (affine)
## and bends it along the diagonal once the surface is turned, so the picture is cut into a grid and every grid point projected.

const GRID: int = 10


## Draw `texture` over the surface whose point at (u, v) in 0..1 lands on screen at `project.call(Vector2(u, v))`, tinted.
static func draw(canvas: CanvasItem, texture: Texture2D, project: Callable, tint: Color = Color.WHITE) -> void:
	var points := PackedVector2Array()
	var uvs := PackedVector2Array()
	for j: int in GRID + 1:
		for i: int in GRID + 1:
			var uv := Vector2(float(i) / GRID, float(j) / GRID)
			points.append(project.call(uv))
			uvs.append(uv)
	var indices := PackedInt32Array()
	for j: int in GRID:
		for i: int in GRID:
			var a := j * (GRID + 1) + i
			var c := a + GRID + 1
			indices.append_array([a, a + 1, c + 1, a, c + 1, c])
	var tints := PackedColorArray()
	tints.resize(points.size())
	tints.fill(tint)
	RenderingServer.canvas_item_add_triangle_array(canvas.get_canvas_item(), indices, points, tints, uvs, PackedInt32Array(),
		PackedFloat32Array(), texture.get_rid())
