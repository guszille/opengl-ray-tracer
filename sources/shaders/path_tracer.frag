#version 460 core

out vec4 FragColor;

struct Ray
{
    vec3 origin, direction;
};

struct Material
{
    /* Acceptable types:
     *
     *  0: LAMBERTIAN
     *  1: METAL
     *  2: DIELECTRIC
     */
    int type;

    vec3 albedo, emission;

    float fuzz, indexOfRefraction;
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

    bool hit, frontFace;
};

const int NUM_SPHERES = 68;

uniform vec3 uCameraPosition;
uniform mat4 uInverseProjectionMatrix; // To unproject screen coordinates.
uniform mat4 uInverseViewMatrix; // To transform from camera to world space.
uniform vec2 uViewportSize = vec2(1600, 900); // Dimensions of the viewport (e.g., window width, window height).
uniform vec3 uSkyColor = vec3(0.5, 0.7, 1.0); // Background color.
uniform int uMaxBounces = 64; // Max number of ray bounces.
uniform Sphere uSpheres[NUM_SPHERES];

/*
uniform float uTime;

float randomState;

void startRandomState(vec2 seed)
{
    randomState = fract(sin(dot(seed, vec2(12.9898, 78.2330))) * 43758.5453);
}

float getRandomNumber(float min, float max)
{
    randomState = fract(randomState * 16807.0);

    return min + (randomState * (max - min));
}

vec3 getRandomVec(float min, float max)
{
    return vec3(getRandomNumber(min, max), getRandomNumber(min, max), getRandomNumber(min, max));
}

vec3 getRandomVecInUnitSphere()
{
    while (true)
    {
        vec3 p = getRandomVec(-1.0, 1.0);

        if (dot(p, p) < 1.0)
        {
            return p;
        }
    }
}

vec3 getRandomUnitVec()
{
    return normalize(getRandomVec(-1.0, 1.0));
}

startRandomState((gl_FragCoord.xy / uViewportSize.xy) * uTime);
*/

float getRandomNumber()
{
    return 0.5;
}

vec3 getRandomUnitVec()
{
    return vec3(0.0);
}

float getMaterialReflectance(in float indexOfRefraction, in float cosTheta)
{
    // Use Schlick's approximation for reflectance.
    float r0 = (1 - indexOfRefraction) / (1 + indexOfRefraction);
    float r1 = r0 * r0;

    return r1 + (1 - r1) * pow((1 - cosTheta), 5);
}

void setHitRecordFaceNormal(in Ray r, in vec3 outwardNormal, inout HitRecord rec)
{
    rec.frontFace = dot(r.direction, outwardNormal) < 0;
    rec.normal = rec.frontFace ? outwardNormal : -outwardNormal;
}

HitRecord sphereHit(in Ray r, in Sphere s)
{
    HitRecord rec;

    rec.hit = false;
    rec.t = 1e20;

    vec3 oc = r.origin - s.center;

    float a = dot(r.direction, r.direction);
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

        if (tClosest < 1e20)
        {
            rec.hit = true;
            rec.t = tClosest;
            rec.point = r.origin + r.direction * rec.t;
            rec.material = s.material;

            setHitRecordFaceNormal(r, normalize(rec.point - s.center), rec);
        }
    }

    return rec;
}

HitRecord sceneHit(in Ray r)
{
    HitRecord closestRec;

    closestRec.hit = false;
    closestRec.t = 1e20;

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
    return normalize((uInverseViewMatrix * eyeCoords).xyz);
}

void main()
{
    vec3 finalColor = vec3(0.0);
    vec3 accumulatedAttenuation = vec3(1.0); // How much light is carried/reflected.
    bool scattered = true;
    Ray r;

    r.origin = uCameraPosition;
    r.direction = getRayDirection(gl_FragCoord.xy);

    for (int bounce = 0; bounce < uMaxBounces; ++bounce)
    {
        if (bounce == uMaxBounces - 1)
        {
            accumulatedAttenuation *= vec3(0.0);

            break;
        }

        HitRecord rec = sceneHit(r);

        if (rec.hit)
        {
            if (!scattered)
            {
                accumulatedAttenuation *= vec3(0.0);

                break;
            }

            vec3 normalizedDir = normalize(r.direction);

            // Add emission from the surface itself (if it's a light source).
            finalColor += rec.material.emission * accumulatedAttenuation;

            // Add albedo and claculate the scatter direction.
            switch (rec.material.type)
            {
            case 0: // Lambertian material.
                r.origin = rec.point;
                r.direction = rec.normal + getRandomUnitVec();

                // Catch degenerate scatter direction.
                if (length(r.direction) < 1e8)
                {
                    r.direction = rec.normal;
                }

                accumulatedAttenuation *= rec.material.albedo;
                scattered = true;

                break;

            case 1: // Metal material.
                r.origin = rec.point;
                r.direction = reflect(normalizedDir, rec.normal) + (rec.material.fuzz * getRandomUnitVec());

                accumulatedAttenuation *= rec.material.albedo;
                scattered = dot(r.direction, rec.normal) > 0.0;

                break;

            case 2: // Dielectric material.
                bool cannotRefract = false;

                float refractionRatio = rec.frontFace ? (1.0 / rec.material.indexOfRefraction) : rec.material.indexOfRefraction;
                float cosTheta = min(dot(-normalizedDir, rec.normal), 1.0);
                float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

                cannotRefract = cannotRefract || refractionRatio * sinTheta > 1.0;
                cannotRefract = cannotRefract || getMaterialReflectance(rec.material.indexOfRefraction, cosTheta) > getRandomNumber();

                r.origin = rec.point;

                if (cannotRefract)
                {
                    r.direction = reflect(normalizedDir, rec.normal);
                }
                else
                {
                    r.direction = refract(normalizedDir, rec.normal, refractionRatio);
                }

                accumulatedAttenuation *= vec3(1.0);
                scattered = true;

                break;

            default:
                break;
            }
        }
        else
        {
            float a = 0.5 * (normalize(r.direction).y + 1.0);

            // Ray missed all objects, add sky/background color.
            accumulatedAttenuation *= (1.0 - a) * vec3(1.0) + a * uSkyColor;

            break;
        }
    }

    finalColor += accumulatedAttenuation;

    // Apply gamma correction.
    float gamma = 2.2;

    FragColor = vec4(finalColor, 1.0);
    FragColor.rgb = pow(FragColor.rgb, vec3(1.0 / gamma));
}
