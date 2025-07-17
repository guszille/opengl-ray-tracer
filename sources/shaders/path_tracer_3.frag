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
     *  0: LAMBERTIAN;
     *  1: METAL;
     *  2: DIELECTRIC.
     */
    int type;

    vec3 albedo, specular, emission;

    float roughness, indexOfRefraction;
};

struct Sphere
{
    vec3 center;

    float radius;

    Material material;
};

struct PointLight
{
    vec3 position, color;

    float radius, power;
};

struct HitRecord
{
    vec3 point, normal;

    float t;

    Material material;

    bool frontFace;
};

const int NUM_SPHERES = 5; // + 64;
const int NUM_LIGHTS = 1;
const float EPSILON = 0.001;
const float MAX_DISTANCE = 1000.0; // Camera frustum distance.
const float PI = 3.14159265359;

uniform vec3 uCameraPosition;
uniform mat4 uInverseProjectionMatrix; // To unproject screen coordinates.
uniform mat4 uInverseViewMatrix; // To transform from camera to world space.
uniform vec2 uViewportSize = vec2(1600, 900); // Dimensions of the viewport (e.g., window width, window height).
uniform vec3 uSkyColor = vec3(0.5, 0.7, 1.0); // Background color.
uniform int uMaxBounces = 16; // Max number of ray bounces.
uniform int uMaxShadowRays = 16; // Max number of rays cast to compute shadow.
uniform int uSamplesPerPixel = 32;
uniform Sphere uSpheres[NUM_SPHERES];
uniform PointLight uLights[NUM_LIGHTS];
// uniform float uTime;

float getRandomFloat(in vec2 seed)
{
    return fract(sin(dot(seed, vec2(12.9898, 78.2330))) * 43758.5453123);
}

vec3 getRandomVecInUnitSphere(in vec2 seed)
{
    vec3 p;

    do
    {
        p = 2.0 * vec3(getRandomFloat(seed), getRandomFloat(seed), getRandomFloat(seed)) - vec3(1.0);
    } while (dot(p, p) >= 1.0);

    return p;
}

mat3x3 getTangentSpace(in vec3 normal)
{
    vec3 helper = abs(normal.x) > 0.99 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(normal, helper));
    vec3 binormal = normalize(cross(normal, tangent));

    return mat3x3(tangent, binormal, normal);
}

vec3 sampleHemisphere(in vec3 normal, in float roughness, in vec2 seed)
{
    float r1 = getRandomFloat(seed.xy);
    float r2 = getRandomFloat(seed.yx);
    float smoothness = 1.0 - roughness;
    float alpha = pow(1000.0, smoothness * smoothness);
    float cosTheta = pow(r1, 1.0 / (alpha + 1.0));
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    float phi = 2.0 * PI * r2;

    vec3 tangentSpaceDirection = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);

    return getTangentSpace(normal) * tangentSpaceDirection;
}

void setHitRecordFaceNormal(in Ray r, in vec3 outwardNormal, inout HitRecord rec)
{
    rec.frontFace = dot(r.direction, outwardNormal) < 0;
    rec.normal = rec.frontFace ? outwardNormal : -outwardNormal;
}

bool sphereHit(in Ray r, in Sphere s, in float tMin, in float tMax, inout HitRecord rec)
{
    vec3 oc = r.origin - s.center;

    float a = dot(r.direction, r.direction);
    float b = dot(oc, r.direction);
    float c = dot(oc, oc) - s.radius * s.radius;
    float discriminant = b * b - a * c;
    float root;

    if (discriminant >= 0.0)
    {
        root = (-b - sqrt(discriminant)) / a;

        if (root < tMax && root > tMin)
        {
            rec.t = root;
            rec.point = r.origin + r.direction * rec.t;
            rec.material = s.material;

            vec3 outwardNormal = (rec.point - s.center) / s.radius;

            setHitRecordFaceNormal(r, outwardNormal, rec);

            return true;
        }

        root = (-b + sqrt(discriminant)) / a;

        if (root < tMax && root > tMin)
        {
            rec.t = root;
            rec.point = r.origin + r.direction * rec.t;
            rec.material = s.material;

            vec3 outwardNormal = (rec.point - s.center) / s.radius;

            setHitRecordFaceNormal(r, outwardNormal, rec);

            return true;
        }
    }

    return false;
}

bool worldHit(in Ray r, in float tMin, in float tMax, inout HitRecord rec)
{
    float closestSoFar = tMax;
    HitRecord closestRec;
    bool hit = false;

    for (int i = 0; i < NUM_SPHERES; i++)
    {
        if(sphereHit(r, uSpheres[i], tMin, closestSoFar, closestRec))
        {
            hit = true;
            closestSoFar = closestRec.t;
            rec = closestRec;
        }
    }

    return hit;
}

float getMaterialReflectance(in float indexOfRefraction, in float cosTheta)
{
    // Use Schlick's approximation for reflectance.
    float r0 = pow((1.0 - indexOfRefraction) / (1.0 + indexOfRefraction), 2.0);

    return r0 + (1.0 - r0) * pow((1 - cosTheta), 5.0);
}

bool scatterLambertian(in Ray r, in HitRecord rec, out vec3 attenuation, out Ray scattered, in vec2 seed)
{
    vec3 scatterDirection = sampleHemisphere(rec.normal, 1.0, seed);

    // if (length(scatterDirection) < EPSILON)
    // {
    //     scatterDirection = rec.normal;
    // }

    attenuation = rec.material.albedo;
    scattered = Ray(rec.point, normalize(scatterDirection));

    return true;
}

bool scatterMetal(in Ray r, in HitRecord rec, out vec3 attenuation, out Ray scattered, in vec2 seed)
{
    vec3 reflected = reflect(normalize(r.direction), rec.normal);
    vec3 scatterDirection = sampleHemisphere(reflected, rec.material.roughness, seed);

    attenuation = rec.material.albedo;
    scattered = Ray(rec.point, normalize(scatterDirection));

    return dot(scattered.direction, rec.normal) > 0.0;
}

bool scatterDielectric(in Ray r, in HitRecord rec, out vec3 attenuation, out Ray scattered, in vec2 seed)
{
    float refractionRatio = rec.frontFace ? (1.0 / rec.material.indexOfRefraction) : rec.material.indexOfRefraction;
    float reflectance = 1.0;
    vec3 normalizedDirection = normalize(r.direction);
    vec3 refracted = refract(normalizedDirection, rec.normal, refractionRatio);
    vec3 scatterDirection;

    if (length(refracted) >= EPSILON)
    {
        // Only calculate Schlick's approximation if refraction is possible.
        float cosTheta = min(dot(-normalizedDirection, rec.normal), 1.0);

        reflectance = getMaterialReflectance(rec.material.indexOfRefraction, cosTheta);
    }

    if (reflectance > getRandomFloat(seed))
    {
        scatterDirection = reflect(normalizedDirection, rec.normal);
    }
    else
    {
        scatterDirection = refracted;
    }

    attenuation = vec3(1.0);
    scattered = Ray(rec.point, scatterDirection);

    return true;
}

vec3 getDirectIllumination(in HitRecord rec, in vec2 seed)
{
    vec3 accumulatedContribution = vec3(0.0);

    for (int i = 0; i < NUM_LIGHTS; i++)
    {
        PointLight light = uLights[i];
        int hits = 0;

        float lightDistance = length(light.position - rec.point);
        float attenuation = lightDistance * lightDistance;
        float NdotL = clamp(dot(rec.normal, normalize(light.position - rec.point)), 0.0, 1.0);

        if (NdotL > EPSILON)
        {
            for (int j = 0; j < uMaxShadowRays; j++)
            {
                float x = getRandomFloat(seed + rec.point.xy + vec2(j));
                float y = getRandomFloat(seed + rec.point.yz + vec2(j));
                float z = getRandomFloat(seed + rec.point.zx + vec2(j));

                vec3 randomDirection = normalize(vec3(x, y, z));
                vec3 lightSurfacePoint = light.position + randomDirection * light.radius;
                vec3 lightDirection = normalize(lightSurfacePoint - rec.point);

                Ray shadowRay = Ray(rec.point, lightDirection);
                HitRecord shadowRec;

                // Cast a shadow ray to check for occlusion.
                if (!worldHit(shadowRay, EPSILON, lightDistance - EPSILON, shadowRec))
                {
                    hits += 1;
                }
            }
        }

        float shadowFactor = 1.0 - (float(hits) / uMaxShadowRays);

        accumulatedContribution += rec.material.albedo * light.color * light.power * NdotL * shadowFactor / attenuation;
    }

    return accumulatedContribution;
}

vec3 getColor(in Ray r, in vec2 seed)
{
    vec3 accumulatedAttenuation = vec3(1.0);
    vec3 accumulatedColor = vec3(0.0);

    for (int bounce = 0; bounce < uMaxBounces; bounce++)
    {
        HitRecord rec;

        if (worldHit(r, EPSILON, MAX_DISTANCE, rec))
        {
            vec3 attenuation;
            Ray scattered;

            // Add emitted light from the surface itself.
            accumulatedColor += accumulatedAttenuation * rec.material.emission;

            // Add direct illumination using "Next Event Estimation".
            accumulatedColor += accumulatedAttenuation * getDirectIllumination(rec, seed);

            // Scatter a ray for the next bounce (indirect illumination).
            switch (rec.material.type)
            {
            case 0: // Lambertian material.
                if (scatterLambertian(r, rec, attenuation, scattered, rec.point.xz + vec2(rec.point.y)))
                {
                    accumulatedAttenuation *= attenuation;
                    r = scattered;
                }
                break;

            case 1: // Metal material.
                if (scatterMetal(r, rec, attenuation, scattered, rec.point.xz + vec2(rec.point.y)))
                {
                    accumulatedAttenuation *= attenuation;
                    r = scattered;
                }
                else
                {
                    return accumulatedColor;
                }
                break;

            case 2: // Dielectric material.
                if (scatterDielectric(r, rec, attenuation, scattered, rec.point.xz + vec2(rec.point.y)))
                {
                    accumulatedAttenuation *= attenuation;
                    r = scattered;
                }
                break;

            default:
                break;
            }
        }
        else
        {
            float alpha = 0.5 * (normalize(r.direction).y + 1.0);

            // Ray missed all objects, add sky/background color.
            accumulatedColor += accumulatedAttenuation * ((1.0 - alpha) * vec3(1.0) + alpha * uSkyColor);

            break;
        }
    }

    return accumulatedColor;
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
    vec2 seed = (gl_FragCoord.xy - 0.5 * uViewportSize.xy) / uViewportSize.y;
    vec3 rayDirection = getRayDirection(gl_FragCoord.xy);

    Ray r = Ray(uCameraPosition, rayDirection);
    vec3 color = getColor(r, seed);

    // Apply gamma correction.
    float gamma = 2.2;
    color = pow(color, vec3(1.0 / gamma));

    FragColor = vec4(color, 1.0); // Final pixel color.
}
