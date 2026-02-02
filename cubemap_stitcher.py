#!/usr/bin/env python3
"""
Cubemap Stitcher - Combines 6 PNG files into a single cubemap image.

The function takes 6 PNG files (right, left, up, down, front, back) and
stitches them into a standard cubemap layout. Also includes conversion
from cubemap to equirectangular panorama.
"""

from PIL import Image
import os
import numpy as np
import math


def stitch_cubemap(base_path, output_path="cubemap.png"):
    """
    Stitch 6 PNG files into a cubemap.
    
    Args:
        base_path (str): Directory path containing the cubemap images (e.g., "/path/to/images/")
                        The function will auto-detect the image name prefix
        output_path (str): Output filename for the stitched cubemap (default: "cubemap.png")
    
    Returns:
        PIL.Image: The stitched cubemap image
        
    The function looks for 6 files with names like:
        <image_name>_right.png, <image_name>_left.png, <image_name>_up.png,
        <image_name>_down.png, <image_name>_front.png, <image_name>_back.png
        
    The standard cubemap layout is:
        [ ][ U ][ ][ ]
        [ L ][ F ][ R ][ B ]
        [ ][ D ][ ][ ]
        
    Where: U=up, D=down, L=left, R=right, F=front, B=back
    """
    
    # Define the face suffixes
    faces = {
        'right': '_right.png',
        'left': '_left.png',
        'up': '_up.png',
        'down': '_down.png',
        'front': '_front.png',
        'back': '_back.png'
    }
    
    # Auto-detect image_name by scanning directory for files with the expected suffixes
    image_name = None
    
    # List all PNG files in the directory
    if os.path.isdir(base_path):
        png_files = [f for f in os.listdir(base_path) if f.endswith('.png')]
    else:
        # If base_path is not a directory, get the directory part
        directory = os.path.dirname(base_path) or '.'
        png_files = [f for f in os.listdir(directory) if f.endswith('.png')]
    
    # Try to find a file ending with one of our suffixes
    for filename in png_files:
        for suffix in faces.values():
            if filename.endswith(suffix):
                # Extract the image_name by removing the suffix
                image_name = filename[:-len(suffix)]
                print(f"Auto-detected image name: '{image_name}'")
                break
        if image_name:
            break
    
    if image_name is None:
        raise FileNotFoundError(f"Could not find any files with expected suffixes (_right.png, _left.png, etc.) in {base_path}")
    
    # Load all face images
    images = {}
    face_size = None
    
    for face_name, suffix in faces.items():
        filepath = base_path + image_name + suffix
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Missing cubemap face: {filepath}")
        
        img = Image.open(filepath)
        
        # Verify all faces are square and same size
        if img.width != img.height:
            raise ValueError(f"{filepath} is not square ({img.width}x{img.height})")
        
        if face_size is None:
            face_size = img.width
        elif img.width != face_size:
            raise ValueError(f"Face size mismatch: {filepath} is {img.width}x{img.width}, expected {face_size}x{face_size}")
        
        images[face_name] = img
    
    # Create the cubemap layout (4x3 grid)
    cubemap_width = face_size * 4
    cubemap_height = face_size * 3
    
    # Create a new image with RGBA mode to support transparency
    cubemap = Image.new('RGBA', (cubemap_width, cubemap_height), (0, 0, 0, 0))
    
    # Paste faces in the standard cubemap layout:
    #     [ ][ U ][ ][ ]
    #     [ L ][ F ][ R ][ B ]
    #     [ ][ D ][ ][ ]
    
    positions = {
        'up':    (face_size * 1, face_size * 0),  # Row 0, Col 1
        'left':  (face_size * 0, face_size * 1),  # Row 1, Col 0
        'front': (face_size * 1, face_size * 1),  # Row 1, Col 1
        'right': (face_size * 2, face_size * 1),  # Row 1, Col 2
        'back':  (face_size * 3, face_size * 1),  # Row 1, Col 3
        'down':  (face_size * 1, face_size * 2),  # Row 2, Col 1
    }
    
    # Paste each face at its position
    for face_name, (x, y) in positions.items():
        # Convert to RGBA if needed
        face_img = images[face_name]
        if face_img.mode != 'RGBA':
            face_img = face_img.convert('RGBA')
        cubemap.paste(face_img, (x, y))
    
    # Save the cubemap
    cubemap.save(output_path)
    print(f"Cubemap saved to: {output_path}")
    print(f"Dimensions: {cubemap_width}x{cubemap_height} ({face_size}x{face_size} per face)")
    
    return cubemap


def cubemap_to_panorama(cubemap_image, output_path="panorama.png", pano_width=4096, pano_height=None, hemisphere_only=False):
    """
    Convert a cubemap to an equirectangular panorama.
    
    Args:
        cubemap_image: Either a PIL Image of the cubemap or a path to the cubemap file
        output_path (str): Output filename for the panorama (default: "panorama.png")
        pano_width (int): Width of the output panorama (default: 4096)
        pano_height (int): Height of the output panorama (default: pano_width/2, or pano_width/4 if hemisphere_only)
        hemisphere_only (bool): If True, only generate the top hemisphere (upper half of cubemap)
    
    Returns:
        PIL.Image: The equirectangular panorama image
        
    The cubemap should be in the standard layout:
        [ ][ U ][ ][ ]
        [ L ][ F ][ R ][ B ]
        [ ][ D ][ ][ ]
    """
    
    # Load cubemap if it's a path
    if isinstance(cubemap_image, str):
        cubemap = Image.open(cubemap_image)
    else:
        cubemap = cubemap_image
    
    # Convert to RGBA if needed
    if cubemap.mode != 'RGBA':
        cubemap = cubemap.convert('RGBA')
    
    # Calculate face size (cubemap is 4 faces wide)
    face_size = cubemap.width // 4
    
    # Default panorama height
    if pano_height is None:
        if hemisphere_only:
            pano_height = pano_width // 4  # Quarter height for hemisphere
        else:
            pano_height = pano_width // 2  # Half height for full sphere
    
    # Convert cubemap to numpy array for faster processing
    cubemap_array = np.array(cubemap)
    
    # Create output panorama array
    panorama = np.zeros((pano_height, pano_width, 4), dtype=np.uint8)
    
    # Face positions in the cubemap layout
    face_positions = {
        'up':    (face_size * 1, face_size * 0),
        'left':  (face_size * 0, face_size * 1),
        'front': (face_size * 1, face_size * 1),
        'right': (face_size * 2, face_size * 1),
        'back':  (face_size * 3, face_size * 1),
        'down':  (face_size * 1, face_size * 2),
    }
    
    print(f"Converting cubemap to panorama ({pano_width}x{pano_height})...")
    if hemisphere_only:
        print("Hemisphere mode: Only rendering top half (sky)")
    
    # For each pixel in the panorama
    for y in range(pano_height):
        for x in range(pano_width):
            # Convert pixel coordinates to spherical coordinates
            # Longitude: 0 to 2π (left to right)
            theta = (x / pano_width) * 2 * math.pi  # longitude
            
            if hemisphere_only:
                # Map y from 0 to pano_height to phi from π/2 (top) to 0 (horizon)
                phi = (math.pi / 2) * (1 - y / pano_height)
            else:
                # Latitude: π/2 to -π/2 (top to bottom) - inverted to fix upside down issue
                phi = (math.pi / 2) - (y / pano_height) * math.pi  # latitude (inverted)
            
            # Convert spherical to cartesian coordinates
            # Note: phi is measured from equator, positive up
            cart_x = math.cos(phi) * math.sin(theta)
            cart_y = math.sin(phi)
            cart_z = math.cos(phi) * math.cos(theta)
            
            # Determine which face this pixel maps to
            abs_x = abs(cart_x)
            abs_y = abs(cart_y)
            abs_z = abs(cart_z)
            
            # Find the dominant axis and corresponding face
            if abs_x >= abs_y and abs_x >= abs_z:
                # Right or Left face
                if cart_x > 0:
                    face = 'right'
                    u = -cart_z / abs_x
                    v = -cart_y / abs_x
                else:
                    face = 'left'
                    u = cart_z / abs_x
                    v = -cart_y / abs_x
            elif abs_y >= abs_x and abs_y >= abs_z:
                # Up or Down face
                if cart_y > 0:
                    face = 'up'
                    u = cart_x / abs_y
                    v = cart_z / abs_y
                else:
                    face = 'down'
                    u = cart_x / abs_y
                    v = -cart_z / abs_y
            else:
                # Front or Back face
                if cart_z > 0:
                    face = 'front'
                    u = cart_x / abs_z
                    v = -cart_y / abs_z
                else:
                    face = 'back'
                    u = -cart_x / abs_z
                    v = -cart_y / abs_z
            
            # Convert u, v from [-1, 1] to pixel coordinates
            face_x = int((u + 1) * 0.5 * face_size)
            face_y = int((v + 1) * 0.5 * face_size)
            
            # Clamp to face boundaries
            face_x = max(0, min(face_size - 1, face_x))
            face_y = max(0, min(face_size - 1, face_y))
            
            # Get the face offset in the cubemap
            offset_x, offset_y = face_positions[face]
            
            # Sample the pixel from the cubemap
            pixel_x = offset_x + face_x
            pixel_y = offset_y + face_y
            
            panorama[y, x] = cubemap_array[pixel_y, pixel_x]
        
        # Progress indicator
        if (y + 1) % (pano_height // 10) == 0:
            print(f"Progress: {int((y + 1) / pano_height * 100)}%")
    
    # Convert back to PIL Image
    panorama_image = Image.fromarray(panorama, 'RGBA')
    panorama_image.save(output_path)
    print(f"Panorama saved to: {output_path}")
    
    return panorama_image


# Example usage
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python cubemap_stitcher.py <base_path> [pano_width] [--hemisphere]")
        print("\nExample:")
        print("  python cubemap_stitcher.py /path/to/images/ 4096")
        print("  python cubemap_stitcher.py /path/to/images/ 4096 --hemisphere")
        print("\nThis will:")
        print("  1. Auto-detect image name from files ending with _right.png, _left.png, etc.")
        print("  2. Stitch cubemap from the 6 detected faces")
        print("  3. Save cubemap to: <base_path>cubemap.png")
        print("  4. Convert to panorama: <base_path>pano.png")
        print("\nOptions:")
        print("  --hemisphere    Only render the top hemisphere (sky only)")
        sys.exit(1)
    
    try:
        # Get base path and optional panorama width
        base_path = sys.argv[1]
        pano_width = 4096
        hemisphere_only = False
        
        # Parse additional arguments
        for arg in sys.argv[2:]:
            if arg == "--hemisphere":
                hemisphere_only = True
            elif arg.isdigit():
                pano_width = int(arg)
        
        # Define output paths
        cubemap_output = base_path + "cubemap.png"
        if hemisphere_only:
            pano_output = base_path + "pano_hemisphere.png"
        else:
            pano_output = base_path + "pano.png"
        
        print("=" * 60)
        print("STEP 1: Stitching cubemap from 6 faces...")
        print("=" * 60)
        
        # Stitch the cubemap
        cubemap = stitch_cubemap(base_path, cubemap_output)
        
        print("\n" + "=" * 60)
        print("STEP 2: Converting cubemap to panorama...")
        print("=" * 60)
        
        # Convert to panorama
        panorama = cubemap_to_panorama(cubemap, pano_output, pano_width, hemisphere_only=hemisphere_only)
        
        print("\n" + "=" * 60)
        print("COMPLETE!")
        print("=" * 60)
        print(f"Cubemap saved to: {cubemap_output}")
        print(f"Panorama saved to: {pano_output}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)