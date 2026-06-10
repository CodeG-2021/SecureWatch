declare const config: {
    darkMode: ["class"];
    content: string[];
    theme: {
        extend: {
            colors: {
                surface: string;
                "on-primary": string;
                primary: string;
                "on-tertiary-container": string;
                "surface-tint": string;
                "outline-variant": string;
                "on-primary-fixed": string;
                "on-primary-fixed-variant": string;
                "on-surface-variant": string;
                "surface-container-low": string;
                "on-surface": string;
                "on-secondary-container": string;
                "surface-bright": string;
                "surface-container": string;
                "secondary-container": string;
                background: string;
                error: string;
                "error-container": string;
                "on-error-container": string;
                outline: string;
                "surface-container-lowest": string;
                "secondary-fixed": string;
                secondary: string;
                "surface-variant": string;
                "on-primary-container": string;
                "primary-container": string;
            };
            borderRadius: {
                DEFAULT: string;
                lg: string;
                xl: string;
                "2xl": string;
                "3xl": string;
                full: string;
            };
            fontFamily: {
                sans: [string, string, string];
                display: [string, string, string];
            };
            fontSize: {
                "headline-md": [string, {
                    lineHeight: string;
                    fontWeight: string;
                }];
                "body-sm": [string, {
                    lineHeight: string;
                    fontWeight: string;
                }];
                "label-sm": [string, {
                    lineHeight: string;
                    letterSpacing: string;
                    fontWeight: string;
                }];
                "body-lg": [string, {
                    lineHeight: string;
                    fontWeight: string;
                }];
                "body-md": [string, {
                    lineHeight: string;
                    fontWeight: string;
                }];
                "headline-lg": [string, {
                    lineHeight: string;
                    fontWeight: string;
                }];
                "label-md": [string, {
                    lineHeight: string;
                    letterSpacing: string;
                    fontWeight: string;
                }];
                display: [string, {
                    lineHeight: string;
                    fontWeight: string;
                }];
            };
        };
    };
    plugins: {
        handler: () => void;
    }[];
};
export default config;
