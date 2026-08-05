import bpy, math, os, tempfile
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = 24
sc.cycles.device = 'CPU'
sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 480, 360
sc.render.film_transparent = False
# ground plane so we can PROVE a cast shadow exists
bpy.ops.mesh.primitive_plane_add(size=20, location=(0,0,0))
bpy.ops.mesh.primitive_cube_add(size=2, location=(0,0,1))
bpy.ops.object.light_add(type='SUN', location=(4,-4,6))
bpy.context.object.data.energy = 5
bpy.context.object.rotation_euler = (math.radians(50), 0, math.radians(40))
bpy.ops.object.camera_add(location=(9,-9,6), rotation=(math.radians(62),0,math.radians(45)))
sc.camera = bpy.context.object
# No hardcoded session scratchpad — that path dies with the container it was written in.
out = os.environ.get('BL_SMOKE_OUT') or os.path.join(tempfile.gettempdir(), 'bl-smoke.png')
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("RENDER_OK", out, os.path.getsize(out), "bytes")
