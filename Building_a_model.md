# Instructions For Adding a New Model to 3D Viewer
## In Your Photogrammetry Software
1. Export the model as an obj file. 
    * Textures should be jpgs, and we usually break our textures into 2-4 seperate files.
    * Try to keep the size down--think about people who have to pay for data by the megabyte. Both texture and the number of polygons can eat up disk space. A          model should maybe be 30 MB or less, so if yours is too big, try decimating the model (fewer polygons), making the textures smaller, or making fewer             textures.
## In Blender (Instructions use version 3.2.2)
1.	Use File->Import to import the desired OBJ file for the model.
2.	Ensure that the model is centered on the world-space origin (0,0,0)
    * Left click object.
    * Click Object->Set Origin->Origin to Geometry
3.	Orient the object such that the bottom is lined on the XY plane.
    * In Blender, use left click to select, G+[X,Y,Z] to move, and R+[X,Y,Z] to rotate and S+[X,Y,Z] to scale.
    * If you don’t have a keyboard with a numpad where you can use the num keys to control the camera, use ctrl+alt+Q for Quad View to make this process easier.
4.	Add a pedestal to cover the hole in the bottom of the model if it is needed. 
    * Objects->Add->Cube, and adjust position to cover hole as in step 3.
5.	For each text area or are of interest that should be clickable, place a cube over the area and resize and adjust it so that it covers the area. This is the area that users will click when they want to find out more about an area of interest. You should also rename it to reflect what it is so that you can easily refer to it in the xml, and so that people who read the XML can understand what it refers to. 
    * You can model this hitbox and shape it to fit the area, but it must overlap the area. Also, keep in mind that it should be small quick to load, so don’t make it too complicated.
    * Select the hitbox and either use either the “Shading” tab at the top to add a new material, or use or the “Material Properties” setting on the right side of the screen to add a new material to this geometry. You can set the “Base Color” under surface to yellow or a desired color. The viewer will set the alpha value automatically.
    * Give the new hitbox a name indicating that it is a hitbox, that it corresponds to a particular type of point of interest (ie. “text”) and what part of a text it corresponds to. 
        - For example, a hitbox corresponding to an entire inscription written in one line would be: “hitbox_text_1”, or, if there are multiple single line inscriptions independent from each other, “hitbox_text_[X where x is the number of the inscription]”
        - If an inscription has multiple lines of the same inscription and it has been decided to indicate these lines as individually clickable items, you can also indicate a subset of a longer text, with a name indicating a section number as the last element. For example, a hitbox with the fourth line of a single four-line spell would be “hitbox_text_1_4”
        - At this moment, we can technically have areas of interest that are not texts, but this feature hasn’t really been tested or differentiated visually from text items in the UI. If you make one, you should give it a name indicating what type of area of interest it is, ie “hitbox_vignette_1”
6. Export the scene as a glTF file.
    * Use file->export->glTF 2.0 to open the export window.
    * In the export window, under the Format dropdown, choose “glTF Embedded (*.gltf)”
    * Save the file in the assets directory in your 3DViewer project, in a subfolder with a descriptive name.
 


