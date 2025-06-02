#version 460 core

out vec4 FragColor;

struct Ray
{
    vec3 origin, direction;
};

struct Material
{
    vec3 albedo, emission;

    float reflectivity; // 0.0 for diffuse, 1.0 for perfect mirror.

    // Could add: roughness, metallic, indexOfRefraction, etc.
};

struct Sphere
{
    vec3 center;

    float radius;

    Material material;
};

struct HitRecord
{
    vec3 point, normal;

    float t;

    Material material;

    bool hit;
};

const int NUM_SPHERES = 2;

uniform vec3 uCameraPosition;
uniform mat4 uInverseProjectionMatrix; // To unproject screen coordinates.
uniform mat4 uInverseViewMatrix; // To transform from camera to world space.
uniform vec2 uViewportSize = vec2(1600, 900); // Dimensions of the viewport (e.g., window width, window height).
uniform vec3 skyColor = vec3(0.5, 0.7, 1.0); // Background color.
uniform int uMaxBounces = 16; // Max number of ray bounces.
uniform Sphere uSpheres[NUM_SPHERES];

HitRecord sphereHit(in Ray r, in Sphere s)
{
    HitRecord rec;

    rec.hit = false;
    rec.t = 1e20; // A very large number (effectively infinity).

    vec3 oc = r.origin - s.center;

    float a =  dot(r.direction, r.direction); // Should be 1.0 if "r.direction" is normalized.
    float b = 2.0 * dot(oc, r.direction);
    float c = dot(oc, oc) - s.radius * s.radius;
    float discriminant = b * b - 4.0 * a * c;

    if (discriminant >= 0.0)
    {
        float t1 = (-b - sqrt(discriminant)) / (2.0 * a);
        float t2 = (-b + sqrt(discriminant)) / (2.0 * a);
        float tClosest = 1e20;

        if (t1 > 0.001 && t1 < tClosest) tClosest = t1; // Epsilon to avoid self-intersection.
        if (t2 > 0.001 && t2 < tClosest) tClosest = t2;

        if (tClosest < 1e19)
        {
            rec.hit = true;
            rec.t = tClosest;
            rec.point = r.origin + r.direction * rec.t;
            rec.normal = normalize(rec.point - s.center);
            rec.material = s.material;
        }
    }

    return rec;
}

HitRecord sceneHit(in Ray r)
{
    HitRecord closestRec;

    closestRec.hit = false;
    closestRec.t = 1e20; // Initialize with a very large distance.

    for (int i = 0; i < NUM_SPHERES; ++i)
    {
        HitRecord currentRec = sphereHit(r, uSpheres[i]);

        if (currentRec.hit && currentRec.t < closestRec.t)
        {
            closestRec = currentRec;
        }
    }

    return closestRec;
}

vec3 getRayDirection(in vec2 fragCoord)
{
    // Convert fragment coordinates to "Normalized Device Coordinates" (NDC).
    vec2 ndc = (fragCoord / uViewportSize) * 2.0 - 1.0;
    // ndc.y = -ndc.y; // Uncomment if your Y is flipped.

    // Create a ray in clip space.
    vec4 clipCoords = vec4(ndc.x, ndc.y, -1.0, 1.0); // -1.0 for z: into the screen (OpenGL convention).

    // Transform to eye/camera space.
    vec4 eyeCoords = vec4((uInverseProjectionMatrix * clipCoords).xy, -1.0, 0.0); // Set z to -1 (forward), w to 0 for a direction vector.

    // Transform to world space.
    vec3 worldDirection = normalize((uInverseViewMatrix * eyeCoords).xyz);

    return worldDirection;
}

void main()
{
    vec3 finalColor = vec3(0.0);
    vec3 accumulatedAttenuation = vec3(1.0); // How much light is carried/reflected.
    Ray r;

    r.origin = uCameraPosition;
    r.direction = getRayDirection(gl_FragCoord.xy);

    for (int bounce = 0; bounce < uMaxBounces; ++bounce)
    {
        HitRecord rec = sceneHit(r);

        if (rec.hit)
        {
            // Add emission from the surface itself (if it's a light source).
            finalColor += rec.material.emission * accumulatedAttenuation;

            // Check for reflection.
            if (rec.material.reflectivity > 0.0 && bounce < uMaxBounces -1) // Ensure we don't reflect on the last bounce iteration.
            {
                // Update ray for the next bounce (reflection).
                r.origin = rec.point + rec.normal * 0.001; // Offset to avoid self-intersection.
                r.direction = reflect(r.direction, rec.normal); // GLSL's built-in reflect function.

                accumulatedAttenuation *= rec.material.albedo * rec.material.reflectivity; // Attenuate by surface color and reflectivity.

                // Optional: If attenuation is too low, stop early.
                if (dot(accumulatedAttenuation, accumulatedAttenuation) < 0.01)
                {
                    break;
                }
            }
            else
            {
                // Surface is diffuse or max bounces reached for reflection path. For simplicity, let's assume diffuse surfaces just show their albedo.
                // A real shader would calculate lighting from light sources here.
                finalColor += rec.material.albedo * accumulatedAttenuation;

                break; // Stop bouncing for non-reflective or max bounce on reflective path.
            }
        }
        else
        {
            vec3 unitDirection = normalize(r.direction);

            float a = 0.5 * (unitDirection.y + 1.0);

            vec3 skyAttenuation = (1.0 - a) * vec3(1.0) + a * skyColor;

            // Ray missed all objects, add sky/background color.
            finalColor += skyAttenuation * accumulatedAttenuation;
            // finalColor += skyColor * accumulatedAttenuation;

            break; // Stop bouncing.
        }
    }

    FragColor = vec4(finalColor, 1.0);
}
